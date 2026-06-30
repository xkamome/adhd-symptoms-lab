<script lang="ts">
  import { onMount } from 'svelte'
  import { FocusTunnel, type DecorateApi } from '../../shared/FocusTunnel'
  import { paintingUrl, TARGETS, TASK } from './targets'

  let canvas: HTMLCanvasElement

  let ready = $state(false)
  let foundCount = $state(0)
  let caught = $state(0)
  let missed = $state(0)
  let solved = $state(false)

  let resetFn: (() => void) | null = null

  onMount(() => {
    const ctx = canvas.getContext('2d')!
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    let tunnel: FocusTunnel | null = null
    let pointer: { x: number; y: number } | null = null

    // 遊戲內部狀態（非反應式）
    const found = new Set<string>()
    const holdT: Record<string, number> = {}
    let blips: { x: number; y: number; life: number; max: number }[] = []
    let blipTimer = 1.2
    let solvedFlag = false

    function reset() {
      found.clear()
      for (const k in holdT) holdT[k] = 0
      blips = []
      blipTimer = 1.2
      solvedFlag = false
      foundCount = 0; caught = 0; missed = 0; solved = false
    }

    const decorate = (c: CanvasRenderingContext2D, api: DecorateApi) => {
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.font = `${42 * api.dpr}px serif`
      for (const t of TARGETS) {
        const { x, y } = api.toScreen(t.tx, t.ty)
        c.fillText(t.emoji, x, y)
      }
    }

    function doResize() {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      tunnel?.resize(rect.width, rect.height, dpr)
    }

    const img = new Image()
    img.onload = () => {
      tunnel = new FocusTunnel(img, { decorate })
      doResize()
      ready = true
    }
    img.src = paintingUrl

    const ro = new ResizeObserver(doResize)
    ro.observe(canvas)

    // 輸入
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
      if (!tunnel) return
      const { W, H } = tunnel.size
      tunnel.update(dt, pointer)
      const f = tunnel.focus

      // 找貓：對焦夠清晰 + 中心停在貓上 0.35s
      if (pointer && f.active && f.clarity > 0.7) {
        for (const t of TARGETS) {
          if (found.has(t.id)) continue
          const s = tunnel.imgToScreen(t.tx, t.ty)
          const d = Math.hypot(f.x - s.x, f.y - s.y)
          if (d < 42 * dpr) {
            holdT[t.id] = (holdT[t.id] ?? 0) + dt
            if (holdT[t.id] > 0.35) found.add(t.id)
          } else holdT[t.id] = 0
        }
      } else {
        for (const k in holdT) holdT[k] = 0
      }
      foundCount = found.size
      if (found.size === TARGETS.length && !solvedFlag) { solvedFlag = true; solved = true }

      // 超專注的代價：周邊偶爾閃過小光點，盯著中心就會錯過
      blipTimer -= dt
      if (blipTimer <= 0 && !solvedFlag) { blipTimer = 1.4 + Math.random() * 1.2; spawnBlip(W, H) }
      for (let i = blips.length - 1; i >= 0; i--) {
        const b = blips[i]
        b.life -= dt
        if (pointer && Math.hypot(f.x - b.x, f.y - b.y) < 55 * dpr) { caught++; blips.splice(i, 1); continue }
        if (b.life <= 0) { missed++; blips.splice(i, 1) }
      }
    }

    function draw() {
      if (!tunnel) return
      const dprl = dpr
      tunnel.render(ctx)
      const f = tunnel.focus

      // 周邊光點（刻意小而淡，專注時容易忽略）
      for (const b of blips) {
        const a = Math.min(1, b.life / b.max) * 0.6
        const r = 7 * dprl
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.2)
        g.addColorStop(0, `rgba(255,240,180,${a})`)
        g.addColorStop(1, 'rgba(255,240,180,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(b.x, b.y, r * 2.2, 0, Math.PI * 2); ctx.fill()
      }

      // 已找到的貓：標記位置
      for (const t of TARGETS) {
        if (!found.has(t.id)) continue
        const s = tunnel.imgToScreen(t.tx, t.ty)
        ctx.strokeStyle = 'rgba(74,222,128,0.9)'
        ctx.lineWidth = 3 * dprl
        ctx.beginPath(); ctx.arc(s.x, s.y, 30 * dprl, 0, Math.PI * 2); ctx.stroke()
      }

      // 對焦準心
      if (pointer && f.active) {
        ctx.strokeStyle = `rgba(255,255,255,${0.25 + f.clarity * 0.4})`
        ctx.lineWidth = 1.5 * dprl
        ctx.beginPath(); ctx.arc(f.x, f.y, 5 * dprl, 0, Math.PI * 2); ctx.stroke()
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

    resetFn = reset

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointercancel', onLeave)
      resetFn = null
    }
  })

  function restart() {
    resetFn?.()
  }
</script>

<canvas bind:this={canvas}></canvas>

{#if !ready}
  <div class="loading">載入名畫中…</div>
{/if}

<div class="hud">
  <div class="task">{TASK}</div>
  <div class="stats">
    <span class="found">🐱 {foundCount} / {TARGETS.length}</span>
    <span class="aware" title="專注時瞥見 / 錯過的周邊光點">瞥見 {caught}　·　錯過 {missed}</span>
  </div>
</div>

<div class="hint">移動到一處後「停住不動」就會慢慢對焦放大；一移動就重置</div>

{#if solved}
  <div class="overlay">
    <div class="panel">
      <h1>三隻貓都找到了</h1>
      <p>可是你在超專注的時候，<br />錯過了周邊 <b>{missed}</b> 件一閃而過的事。</p>
      <p class="small">（瞥見 {caught} · 錯過 {missed}）</p>
      <button onclick={restart}>再玩一次</button>
    </div>
  </div>
{/if}

<style>
  canvas {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    cursor: crosshair;
  }
  .loading {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #cbd5e1;
    font-family: system-ui, sans-serif;
  }
  .hud {
    position: fixed;
    top: 0; left: 0; right: 0;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    color: #f1f5f9;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  }
  .task { font-size: 15px; max-width: 640px; }
  .stats { display: flex; gap: 16px; font-size: 14px; }
  .found { font-weight: 700; }
  .aware { color: #fcd34d; }
  .hint {
    position: fixed;
    bottom: 14px; left: 0; right: 0;
    text-align: center;
    font-size: 12px;
    color: rgba(241, 245, 249, 0.55);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    pointer-events: none;
    font-family: system-ui, sans-serif;
  }
  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 10, 16, 0.72);
    backdrop-filter: blur(6px);
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
  }
  .panel {
    background: #12141c;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 18px;
    padding: 28px 34px;
    text-align: center;
    color: #e2e8f0;
    max-width: 360px;
  }
  .panel h1 { font-size: 24px; margin-bottom: 12px; }
  .panel p { color: #cbd5e1; line-height: 1.6; margin-bottom: 8px; }
  .panel .small { font-size: 13px; color: #94a3b8; margin-bottom: 18px; }
  .panel button {
    padding: 12px 28px;
    border: none;
    border-radius: 999px;
    background: #f59e0b;
    color: #1a1206;
    font-size: 16px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
  }
  .panel button:active { transform: scale(0.98); }
</style>
