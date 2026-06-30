<script lang="ts">
  import { onMount } from 'svelte'

  // 任務（不同圖示/顏色；給初始位置，之後會緩慢飄移）
  const TASKS = [
    { x: 22, y: 32, color: '#f59e0b', emoji: '🌻' },
    { x: 78, y: 28, color: '#ef4444', emoji: '🌹' },
    { x: 26, y: 74, color: '#10b981', emoji: '🌵' },
    { x: 74, y: 72, color: '#60a5fa', emoji: '🪴' },
  ]
  const N = TASKS.length

  // 數值
  const RADIUS = 130
  const ATT_UP = 2.5
  const ATT_DOWN = 1.2
  const FILL = 32
  const DECAY = 8
  const SPEED = 2.6 // 飄移速度 (%/s)，很慢
  const X0 = 8, X1 = 92, Y0 = 16, Y1 = 90 // 飄移邊界 (%)

  const KEY = 'oos-best'
  function loadBest(): number | null {
    const v = Number(localStorage.getItem(KEY))
    return v > 0 ? v : null
  }

  let arena: HTMLDivElement

  let attention = $state<number[]>(TASKS.map(() => 0))
  let progress = $state<number[]>(TASKS.map(() => 0))
  let done = $state<boolean[]>(TASKS.map(() => false))
  let posX = $state<number[]>(TASKS.map((t) => t.x))
  let posY = $state<number[]>(TASKS.map((t) => t.y))
  let won = $state(false)
  let elapsed = $state(0)
  let bestTime = $state<number | null>(loadBest())

  const doneCount = $derived(done.filter(Boolean).length)

  let restart = $state<() => void>(() => {})

  onMount(() => {
    let pointer: { x: number; y: number } | null = null
    let timeSec = 0
    const vx: number[] = new Array(N).fill(0)
    const vy: number[] = new Array(N).fill(0)

    function reset() {
      for (let i = 0; i < N; i++) {
        attention[i] = 0; progress[i] = 0; done[i] = false
        posX[i] = TASKS[i].x; posY[i] = TASKS[i].y
        const a = Math.random() * Math.PI * 2
        vx[i] = Math.cos(a) * SPEED; vy[i] = Math.sin(a) * SPEED
      }
      won = false; timeSec = 0; elapsed = 0
    }
    reset()
    restart = reset

    const pos = (e: PointerEvent) => {
      const r = arena.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onMove = (e: PointerEvent) => { pointer = pos(e) }
    const onDown = (e: PointerEvent) => { pointer = pos(e); if (e.pointerType === 'touch') arena.setPointerCapture(e.pointerId) }
    const onUp = (e: PointerEvent) => { if (e.pointerType === 'touch') pointer = null }
    const onLeave = () => { pointer = null }
    arena.addEventListener('pointermove', onMove)
    arena.addEventListener('pointerdown', onDown)
    arena.addEventListener('pointerup', onUp)
    arena.addEventListener('pointerleave', onLeave)
    arena.addEventListener('pointercancel', onLeave)

    let raf = 0
    let last = performance.now()
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      if (!won) {
        timeSec += dt
        elapsed = timeSec
        const rect = arena.getBoundingClientRect()
        for (let i = 0; i < N; i++) {
          if (done[i]) { attention[i] = 1; continue }

          // 緩慢隨機飄移：輕微轉向 + 邊界反彈
          const da = (Math.random() - 0.5) * 1.0 * dt
          const c = Math.cos(da), s = Math.sin(da)
          const nvx = vx[i] * c - vy[i] * s
          const nvy = vx[i] * s + vy[i] * c
          vx[i] = nvx; vy[i] = nvy
          posX[i] += vx[i] * dt; posY[i] += vy[i] * dt
          if (posX[i] < X0) { posX[i] = X0; vx[i] = Math.abs(vx[i]) }
          if (posX[i] > X1) { posX[i] = X1; vx[i] = -Math.abs(vx[i]) }
          if (posY[i] < Y0) { posY[i] = Y0; vy[i] = Math.abs(vy[i]) }
          if (posY[i] > Y1) { posY[i] = Y1; vy[i] = -Math.abs(vy[i]) }

          const tx = (posX[i] / 100) * rect.width
          const ty = (posY[i] / 100) * rect.height
          const near = pointer && Math.hypot(pointer.x - tx, pointer.y - ty) < RADIUS
          attention[i] = Math.max(0, Math.min(1, attention[i] + (near ? ATT_UP : -ATT_DOWN) * dt))
          if (attention[i] > 0.6) progress[i] = Math.min(100, progress[i] + FILL * dt)
          else progress[i] = Math.max(0, progress[i] - DECAY * dt)
          if (progress[i] >= 100) { done[i] = true; attention[i] = 1 }
        }
        if (done.every(Boolean)) {
          won = true
          const t = Math.round(timeSec * 10) / 10
          if (bestTime === null || t < bestTime) { bestTime = t; localStorage.setItem(KEY, String(t)) }
          elapsed = t
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      arena.removeEventListener('pointermove', onMove)
      arena.removeEventListener('pointerdown', onDown)
      arena.removeEventListener('pointerup', onUp)
      arena.removeEventListener('pointerleave', onLeave)
      arena.removeEventListener('pointercancel', onLeave)
    }
  })

  const fmt = (s: number) => s.toFixed(1)
</script>

<div class="arena" bind:this={arena}>
  {#each TASKS as t, i}
    <div
      class="task"
      class:done={done[i]}
      style="left:{posX[i]}%; top:{posY[i]}%; --c:{t.color}; opacity:{done[i] ? 1 : attention[i]}"
    >
      <div class="icon">{done[i] ? '✓' : t.emoji}</div>
      <div class="bar"><div class="fill" style="width:{progress[i]}%"></div></div>
    </div>
  {/each}
</div>

<div class="hud">
  <div class="row">
    <span class="timer">{fmt(elapsed)}s</span>
    {#if bestTime !== null}<span class="best">最佳 {fmt(bestTime)}s</span>{/if}
    <span class="count">完成 {doneCount} / {N}</span>
  </div>
  <div class="task-desc">把游標停在盆栽上「澆水」填滿它；一移開它就枯萎並消失——它們還會慢慢飄走，你得記住跑去哪了。</div>
</div>

{#if won}
  <div class="overlay">
    <div class="panel">
      <h1>四盆都顧好了</h1>
      <p class="big">花了 <b>{fmt(elapsed)}</b> 秒</p>
      {#if bestTime !== null}<p class="small">最佳 {fmt(bestTime)}s</p>{/if}
      <p class="cost">你有沒有發現——一移開視線，它們就從你腦中消失了？</p>
      <button class="primary" onclick={restart}>再玩一次</button>
    </div>
  </div>
{/if}

<style>
  .arena { position: fixed; inset: 0; touch-action: none; cursor: crosshair; overflow: hidden; }
  .task {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition: opacity 0.45s ease;
    pointer-events: none;
  }
  .icon {
    width: 64px; height: 64px;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: 2px solid var(--c);
    box-shadow: 0 0 18px -4px var(--c);
  }
  .task.done .icon { background: var(--c); color: #0a0c12; border-color: var(--c); }
  .bar {
    width: 80px; height: 8px; border-radius: 999px;
    background: rgba(255, 255, 255, 0.12); overflow: hidden;
  }
  .fill { height: 100%; background: var(--c); border-radius: 999px; }

  .hud {
    position: fixed; top: 0; left: 0; right: 0; padding: 14px 18px;
    display: flex; flex-direction: column; gap: 6px; pointer-events: none;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    color: #f1f5f9; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  }
  .row { display: flex; align-items: baseline; gap: 16px; }
  .timer { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .best { font-size: 13px; color: #fcd34d; }
  .count { font-size: 14px; margin-left: auto; font-weight: 700; }
  .task-desc { font-size: 13px; color: #aeb8c8; max-width: 640px; }

  .overlay {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    background: rgba(8, 10, 16, 0.74); backdrop-filter: blur(6px); padding: 20px;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
  }
  .panel {
    background: #12141c; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px;
    padding: 26px 32px; text-align: center; color: #e2e8f0; max-width: 360px;
  }
  .panel h1 { font-size: 24px; margin-bottom: 8px; }
  .big { font-size: 18px; color: #cbd5e1; margin-bottom: 4px; }
  .big b { color: #f59e0b; font-size: 22px; }
  .small { font-size: 13px; color: #94a3b8; margin-bottom: 12px; }
  .cost { font-size: 13px; color: #94a3b8; margin-bottom: 18px; }
  .primary {
    padding: 12px 28px; border: none; border-radius: 999px; background: #f59e0b;
    color: #1a1206; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer;
  }
  .primary:active { transform: scale(0.98); }
</style>
