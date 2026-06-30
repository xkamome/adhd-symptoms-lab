<script lang="ts">
  import { onMount } from 'svelte'
  import { FocusTunnel, type DecorateApi } from '../../shared/FocusTunnel'
  import { randomPainting, randomCats, TASK, type CatTarget } from './paintings'

  let canvas: HTMLCanvasElement

  let ready = $state(false)
  let foundCount = $state(0)
  let missed = $state(0)
  let caught = $state(0)
  let elapsed = $state(0)
  let ended = $state(false)
  let result = $state<'found' | 'gaveup'>('found')
  let finalTime = $state(0)
  let title = $state('')

  type Rec = { result: 'found' | 'gaveup'; seconds: number; painting: string; ts: number }
  const KEY = 'hf-records'
  let records = $state<Rec[]>(loadRecords())

  function loadRecords(): Rec[] {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  }
  function saveRecord(r: Rec) {
    const all = [...loadRecords(), r].slice(-60)
    localStorage.setItem(KEY, JSON.stringify(all))
    records = all
  }
  const bestFound = $derived(
    records.filter((r) => r.result === 'found').reduce((m, r) => Math.min(m, r.seconds), Infinity),
  )
  const recent = $derived([...records].reverse().slice(0, 5))

  let startRound = $state<() => void>(() => {})
  let giveUp = $state<() => void>(() => {})

  onMount(() => {
    const ctx = canvas.getContext('2d')!
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const imgCache = new Map<string, HTMLImageElement>()

    let tunnel: FocusTunnel | null = null
    let pointer: { x: number; y: number } | null = null
    let cats: CatTarget[] = []
    const found = new Set<string>()
    const holdT: Record<string, number> = {}
    let blips: { x: number; y: number; life: number; max: number }[] = []
    let blipTimer = 1.2
    let timeSec = 0
    let running = false

    function doResize() {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      tunnel?.resize(rect.width, rect.height, dpr)
    }

    function newRound() {
      const p = randomPainting()
      cats = randomCats(3)
      title = p.title
      ready = false; running = false; ended = false
      found.clear()
      for (const k in holdT) delete holdT[k]
      blips = []; blipTimer = 1.2; timeSec = 0
      foundCount = 0; missed = 0; caught = 0; elapsed = 0

      const decorate = (c: CanvasRenderingContext2D, api: DecorateApi) => {
        c.textAlign = 'center'; c.textBaseline = 'middle'
        c.font = `${40 * api.dpr}px serif`
        for (const t of cats) { const { x, y } = api.toScreen(t.tx, t.ty); c.fillText(t.emoji, x, y) }
      }

      let img = imgCache.get(p.url)
      const init = () => {
        tunnel = new FocusTunnel(img!, { decorate })
        doResize()
        ready = true; running = true
      }
      if (!img) {
        img = new Image()
        imgCache.set(p.url, img)
        img.onload = init
        img.src = p.url
      } else if (img.complete && img.naturalWidth) {
        init()
      } else {
        img.onload = init
      }
    }

    function endRound(res: 'found' | 'gaveup') {
      if (ended) return
      running = false; ended = true; result = res; finalTime = timeSec
      saveRecord({ result: res, seconds: Math.round(timeSec * 10) / 10, painting: title, ts: Date.now() })
    }

    startRound = newRound
    giveUp = () => { if (running) endRound('gaveup') }

    const ro = new ResizeObserver(doResize)
    ro.observe(canvas)

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onMove = (e: PointerEvent) => { pointer = pos(e) }
    const onDown = (e: PointerEvent) => { pointer = pos(e); if (e.pointerType === 'touch') canvas.setPointerCapture(e.pointerId) }
    const onUp = (e: PointerEvent) => { if (e.pointerType === 'touch') pointer = null }
    const onLeave = () => { pointer = null }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointercancel', onLeave)

    function spawnBlip(W: number, H: number) {
      const m = 60 * dpr
      blips.push({ x: m + Math.random() * (W - 2 * m), y: m + Math.random() * (H - 2 * m), life: 2.6, max: 2.6 })
    }

    function step(dt: number) {
      if (!tunnel || !running) return
      const { W, H } = tunnel.size
      timeSec += dt
      elapsed = timeSec
      tunnel.update(dt, pointer)
      const f = tunnel.focus

      if (pointer && f.active && f.clarity > 0.7) {
        for (const t of cats) {
          if (found.has(t.id)) continue
          const s = tunnel.imgToScreen(t.tx, t.ty)
          if (Math.hypot(f.x - s.x, f.y - s.y) < 42 * dpr) {
            holdT[t.id] = (holdT[t.id] ?? 0) + dt
            if (holdT[t.id] > 0.3) found.add(t.id)
          } else holdT[t.id] = 0
        }
      } else {
        for (const k in holdT) holdT[k] = 0
      }
      foundCount = found.size
      if (found.size === cats.length) { endRound('found'); return }

      blipTimer -= dt
      if (blipTimer <= 0) { blipTimer = 1.4 + Math.random() * 1.2; spawnBlip(W, H) }
      for (let i = blips.length - 1; i >= 0; i--) {
        const b = blips[i]
        b.life -= dt
        if (pointer && Math.hypot(f.x - b.x, f.y - b.y) < 55 * dpr) { caught++; blips.splice(i, 1); continue }
        if (b.life <= 0) { missed++; blips.splice(i, 1) }
      }
    }

    function draw() {
      if (!tunnel) return
      tunnel.render(ctx)
      const f = tunnel.focus
      for (const b of blips) {
        const a = Math.min(1, b.life / b.max) * 0.6
        const r = 7 * dpr
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.2)
        g.addColorStop(0, `rgba(255,240,180,${a})`)
        g.addColorStop(1, 'rgba(255,240,180,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(b.x, b.y, r * 2.2, 0, Math.PI * 2); ctx.fill()
      }
      for (const t of cats) {
        if (!found.has(t.id)) continue
        const s = tunnel.imgToScreen(t.tx, t.ty)
        ctx.strokeStyle = 'rgba(74,222,128,0.9)'
        ctx.lineWidth = 3 * dpr
        ctx.beginPath(); ctx.arc(s.x, s.y, 30 * dpr, 0, Math.PI * 2); ctx.stroke()
      }
      if (pointer && f.active) {
        ctx.strokeStyle = `rgba(255,255,255,${0.25 + f.clarity * 0.4})`
        ctx.lineWidth = 1.5 * dpr
        ctx.beginPath(); ctx.arc(f.x, f.y, 4 * dpr, 0, Math.PI * 2); ctx.stroke()
      }
    }

    let raf = 0
    let last = performance.now()
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    newRound()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointercancel', onLeave)
    }
  })

  const fmt = (s: number) => s.toFixed(1)
</script>

<canvas bind:this={canvas}></canvas>

{#if !ready}
  <div class="loading">載入名畫中…</div>
{/if}

<div class="hud">
  <div class="row">
    <span class="timer">{fmt(elapsed)}s</span>
    {#if bestFound !== Infinity}<span class="best">最快 {fmt(bestFound)}s</span>{/if}
    {#if !ended}<button class="giveup" onclick={giveUp}>放棄</button>{/if}
  </div>
  <div class="task">{TASK}</div>
  <div class="stats">
    <span class="found">🐱 {foundCount} / 3</span>
    <span class="aware" title="專注時瞥見 / 錯過的周邊光點">瞥見 {caught} · 錯過 {missed}</span>
    <span class="ptitle">{title}</span>
  </div>
</div>

<div class="hint">移到一處「停住不動」→ 中央立刻變清晰、周邊更糊；一移動就重置</div>

{#if ended}
  <div class="overlay">
    <div class="panel">
      {#if result === 'found'}
        <h1>找到 3 隻貓</h1>
        <p class="big">花了 <b>{fmt(finalTime)}</b> 秒</p>
      {:else}
        <h1>放棄了</h1>
        <p class="big">你盯了 <b>{fmt(finalTime)}</b> 秒</p>
      {/if}
      <p class="cost">超專注時你錯過了周邊 <b>{missed}</b> 件一閃而過的事。</p>
      <div class="board">
        <div class="bh">最近紀錄{#if bestFound !== Infinity}　·　最快找到 {fmt(bestFound)}s{/if}</div>
        {#each recent as r}
          <div class="rrow">
            <span class="rres" class:f={r.result === 'found'}>{r.result === 'found' ? '✓ 找到' : '✗ 放棄'}</span>
            <span class="rtime">{fmt(r.seconds)}s</span>
            <span class="rpt">{r.painting}</span>
          </div>
        {/each}
      </div>
      <button class="primary" onclick={startRound}>再玩一次</button>
    </div>
  </div>
{/if}

<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
  .loading { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-family: system-ui, sans-serif; }

  .hud {
    position: fixed; top: 0; left: 0; right: 0;
    padding: 12px 16px; display: flex; flex-direction: column; gap: 6px;
    pointer-events: none;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    color: #f1f5f9; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
  }
  .row { display: flex; align-items: center; gap: 14px; }
  .timer { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .best { font-size: 13px; color: #fcd34d; }
  .giveup {
    pointer-events: auto; margin-left: auto;
    padding: 7px 16px; border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 999px; background: rgba(10, 12, 18, 0.5); color: #e2e8f0;
    font-size: 13px; font-family: inherit; cursor: pointer; backdrop-filter: blur(4px);
  }
  .task { font-size: 14px; max-width: 640px; }
  .stats { display: flex; gap: 14px; font-size: 13px; flex-wrap: wrap; }
  .found { font-weight: 700; }
  .aware { color: #fcd34d; }
  .ptitle { color: #93a4bd; }

  .hint {
    position: fixed; bottom: 12px; left: 0; right: 0; text-align: center;
    font-size: 12px; color: rgba(241, 245, 249, 0.55);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85); pointer-events: none;
    font-family: system-ui, sans-serif;
  }

  .overlay {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    background: rgba(8, 10, 16, 0.74); backdrop-filter: blur(6px);
    font-family: system-ui, "Microsoft JhengHei", sans-serif; padding: 20px;
  }
  .panel {
    background: #12141c; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px;
    padding: 26px 30px; text-align: center; color: #e2e8f0; max-width: 380px; width: 100%;
  }
  .panel h1 { font-size: 24px; margin-bottom: 8px; }
  .big { font-size: 18px; color: #cbd5e1; margin-bottom: 6px; }
  .big b { color: #f59e0b; font-size: 22px; }
  .cost { font-size: 13px; color: #94a3b8; margin-bottom: 16px; }
  .board { text-align: left; background: rgba(255, 255, 255, 0.04); border-radius: 12px; padding: 10px 12px; margin-bottom: 18px; }
  .bh { font-size: 11px; color: #7c8aa0; letter-spacing: 0.08em; margin-bottom: 6px; }
  .rrow { display: flex; gap: 10px; font-size: 13px; padding: 2px 0; align-items: baseline; }
  .rres { color: #f87171; width: 56px; }
  .rres.f { color: #4ade80; }
  .rtime { font-variant-numeric: tabular-nums; width: 48px; color: #e2e8f0; }
  .rpt { color: #93a4bd; font-size: 12px; }
  .primary {
    padding: 12px 28px; border: none; border-radius: 999px; background: #f59e0b;
    color: #1a1206; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer;
  }
  .primary:active { transform: scale(0.98); }
</style>
