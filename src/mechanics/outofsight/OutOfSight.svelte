<script lang="ts">
  import { onMount } from 'svelte'

  // 植物池（每關取前 pots 個）；trait：fillMul 澆滿速度、decayMul 枯萎速度、sip 怕澆太多
  interface PlantDef {
    x: number; y: number; color: string; emoji: string
    fillMul?: number; decayMul?: number; sip?: boolean; hint?: string
  }
  const PLANTS: PlantDef[] = [
    { x: 22, y: 34, color: '#f59e0b', emoji: '🌻' },
    { x: 78, y: 30, color: '#ef4444', emoji: '🌹', decayMul: 1.6, hint: '枯得特別快' },
    { x: 26, y: 74, color: '#10b981', emoji: '🌵', sip: true, hint: '怕澆太多，一口一口澆' },
    { x: 74, y: 72, color: '#60a5fa', emoji: '🪴' },
    { x: 50, y: 52, color: '#c084fc', emoji: '🌷', fillMul: 0.7, hint: '要澆比較久' },
    { x: 50, y: 24, color: '#fbbf24', emoji: '🌼' },
  ]

  // 關卡設定：可做變化的地方都收在這裡
  interface LevelCfg { pots: number; speed: number; decay: number; radius: number; distract: boolean }
  const LEVELS: LevelCfg[] = [
    { pots: 4, speed: 2.6, decay: 8, radius: 130, distract: false },
    { pots: 5, speed: 3.4, decay: 10, radius: 130, distract: true },
    { pots: 6, speed: 4.2, decay: 12, radius: 110, distract: true },
  ]

  const ATT_UP = 2.5
  const ATT_DOWN = 1.2
  const FILL = 32
  const SIP_LIMIT = 2.0 // 連續澆超過這秒數，怕澆太多的植物會開始爛根
  const X0 = 8, X1 = 92, Y0 = 20, Y1 = 90 // 飄移邊界 (%)
  const GHOST_OPACITY = 0.22 // 完成後留下的殘影透明度——代表「即使做完了，還是會不小心一直想到它」
  const BASE_OPACITY = 0.1 // 未完成時的最低可見度——手機沒有滑鼠停在畫面上，得看得到剪影才找得到

  const bestKey = (lv: number) => `oos-best-L${lv + 1}`
  function loadBest(lv: number): number | null {
    const v = Number(localStorage.getItem(bestKey(lv)))
    return v > 0 ? v : null
  }

  let arena: HTMLDivElement

  let level = $state(0)
  let plants = $state<PlantDef[]>(PLANTS.slice(0, LEVELS[0].pots))
  let attention = $state<number[]>([])
  let progress = $state<number[]>([])
  let done = $state<boolean[]>([])
  let draining = $state<boolean[]>([])
  let posX = $state<number[]>([])
  let posY = $state<number[]>([])
  let distractor = $state<{ x: number; y: number } | null>(null)
  let shelfOrder = $state<number[]>([]) // 完成順序（真正完成的紀錄，固定顯示在 HUD，跟場上的殘影分開）
  let interruptions = $state(0)
  let won = $state(false)
  let elapsed = $state(0)
  let bestTime = $state<number | null>(loadBest(0))

  const doneCount = $derived(done.filter(Boolean).length)
  const hasNext = $derived(level + 1 < LEVELS.length)

  let restart = $state<() => void>(() => {})
  let nextLevel = $state<() => void>(() => {})

  onMount(() => {
    let cfg = LEVELS[0]
    // 觸控手指比滑鼠游標粗，感應半徑放寬一點，不然在手機上很難「準確」停在飄移的盆栽上
    const radiusMul = matchMedia('(pointer: coarse)').matches ? 1.35 : 1
    let pointer: { x: number; y: number } | null = null
    let timeSec = 0
    let vx: number[] = []
    let vy: number[] = []
    let hoverSec: number[] = [] // 連續澆水秒數（sip 用）
    let distractLife = 0
    let distractHold = 0
    let nextDistract = 0

    function startLevel(lv: number) {
      level = lv
      cfg = LEVELS[lv]
      plants = PLANTS.slice(0, cfg.pots)
      const n = plants.length
      attention = plants.map(() => 0)
      progress = plants.map(() => 0)
      done = plants.map(() => false)
      draining = plants.map(() => false)
      posX = plants.map((p) => p.x)
      posY = plants.map((p) => p.y)
      vx = new Array(n).fill(0)
      vy = new Array(n).fill(0)
      hoverSec = new Array(n).fill(0)
      shelfOrder = []
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        vx[i] = Math.cos(a) * cfg.speed; vy[i] = Math.sin(a) * cfg.speed
      }
      distractor = null
      distractHold = 0
      nextDistract = 8 + Math.random() * 6
      interruptions = 0
      won = false; timeSec = 0; elapsed = 0
      bestTime = loadBest(lv)
    }
    startLevel(0)
    restart = () => startLevel(level)
    nextLevel = () => startLevel(hasNext ? level + 1 : 0)

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

        // 干擾事件：它在場上時，所有植物枯萎加倍
        if (cfg.distract) {
          if (distractor) {
            distractLife -= dt
            const dx = (distractor.x / 100) * rect.width
            const dy = (distractor.y / 100) * rect.height
            const near = pointer && Math.hypot(pointer.x - dx, pointer.y - dy) < 70
            distractHold = near ? distractHold + dt : 0
            if (distractHold > 0.4) {
              distractor = null // 主動關掉，不算被干擾
              nextDistract = 8 + Math.random() * 6
            } else if (distractLife <= 0) {
              interruptions++
              distractor = null
              nextDistract = 8 + Math.random() * 6
            }
          } else {
            nextDistract -= dt
            if (nextDistract <= 0) {
              distractor = { x: 12 + Math.random() * 76, y: 24 + Math.random() * 60 }
              distractLife = 4
              distractHold = 0
            }
          }
        }
        const decayMul = distractor ? 2 : 1

        for (let i = 0; i < plants.length; i++) {
          const t = plants[i]

          // 緩慢隨機飄移：輕微轉向 + 邊界反彈。完成後也不會停下——
          // 那份殘影會繼續在場上飄，代表「就算做完了，有時候還是沒辦法真的把它從心裡拿走」。
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

          if (done[i]) continue // 已經真正完成：不用再算澆水/進度，只留下持續飄移的殘影

          const tx = (posX[i] / 100) * rect.width
          const ty = (posY[i] / 100) * rect.height
          const near = pointer && Math.hypot(pointer.x - tx, pointer.y - ty) < cfg.radius * radiusMul
          attention[i] = Math.max(0, Math.min(1, attention[i] + (near ? ATT_UP : -ATT_DOWN) * dt))

          hoverSec[i] = near && attention[i] > 0.6 ? hoverSec[i] + dt : 0
          const overwater = !!t.sip && hoverSec[i] > SIP_LIMIT
          draining[i] = overwater

          if (overwater) {
            progress[i] = Math.max(0, progress[i] - FILL * dt) // 爛根：越澆越倒退
          } else if (attention[i] > 0.6) {
            progress[i] = Math.min(100, progress[i] + FILL * (t.fillMul ?? 1) * dt)
          } else {
            progress[i] = Math.max(0, progress[i] - cfg.decay * (t.decayMul ?? 1) * decayMul * dt)
          }
          if (progress[i] >= 100) {
            done[i] = true; draining[i] = false
            shelfOrder = [...shelfOrder, i]
          }
        }
        if (done.every(Boolean)) {
          won = true
          distractor = null
          const t = Math.round(timeSec * 10) / 10
          if (bestTime === null || t < bestTime) { bestTime = t; localStorage.setItem(bestKey(level), String(t)) }
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
  {#each plants as t, i}
    <div
      class="task"
      class:ghost={done[i]}
      class:drain={draining[i]}
      style="left:{posX[i]}%; top:{posY[i]}%; --c:{t.color}; opacity:{done[i] ? GHOST_OPACITY : Math.max(BASE_OPACITY, attention[i])}"
    >
      <div class="icon">{t.emoji}</div>
      {#if !done[i]}
        <div class="bar"><div class="fill" style="width:{progress[i]}%"></div></div>
        {#if t.hint}<div class="phint">{draining[i] ? '爛根了！快移開' : t.hint}</div>{/if}
      {/if}
    </div>
  {/each}

  {#if distractor}
    <div class="distract" style="left:{distractor.x}%; top:{distractor.y}%">
      <div class="dicon">📳</div>
      <div class="dlabel">叮咚！（停上來關掉它）</div>
    </div>
  {/if}
</div>

<div class="hud">
  <div class="row">
    <span class="lv">第 {level + 1}/{LEVELS.length} 關</span>
    <span class="timer">{fmt(elapsed)}s</span>
    {#if bestTime !== null}<span class="best">最佳 {fmt(bestTime)}s</span>{/if}
    <span class="count">完成 {doneCount} / {plants.length}</span>
  </div>
  {#if shelfOrder.length > 0}
    <div class="shelf-row">
      {#each shelfOrder as idx}<span class="shelf-icon" style="--c:{plants[idx].color}">{plants[idx].emoji}</span>{/each}
    </div>
  {/if}
  <div class="task-desc">
    把游標停在盆栽上「澆水」填滿它；一移開它就枯萎並消失——它們還會慢慢飄走。
    真的顧好的會記到上面那排；但那株植物本身的殘影還是會繼續在場上飄——代表就算完成了，你有時候還是沒辦法真的把它從心裡拿走。
    {#if LEVELS[level].distract}小心：通知響的時候，所有植物枯得更快。{/if}
  </div>
</div>

{#if won}
  <div class="overlay">
    <div class="panel">
      <h1>第 {level + 1} 關：{plants.length} 盆都顧好了</h1>
      <p class="big">花了 <b>{fmt(elapsed)}</b> 秒</p>
      {#if bestTime !== null}<p class="small">本關最佳 {fmt(bestTime)}s</p>{/if}
      {#if LEVELS[level].distract}<p class="small">被通知干擾了 {interruptions} 次</p>{/if}
      <p class="cost">你有沒有發現——一移開視線，它們就從你腦中消失了？</p>
      <div class="btns">
        <button class="ghost" onclick={restart}>再玩一次</button>
        <button class="primary" onclick={nextLevel}>{hasNext ? '下一關' : '回第 1 關'}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .arena { position: fixed; inset: 0; touch-action: none; cursor: crosshair; overflow: hidden; }
  .task {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 110px;
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
    transition: transform 0.3s ease;
  }
  .task.ghost .icon {
    background: rgba(255, 255, 255, 0.03);
    box-shadow: none;
    border-color: rgba(255, 255, 255, 0.2);
    filter: grayscale(0.7);
  }
  .task.drain .icon { animation: shake 0.35s ease infinite; border-color: #ef4444; }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-3px); }
    75% { transform: translateX(3px); }
  }
  .bar {
    width: 80px; height: 8px; border-radius: 999px;
    background: rgba(255, 255, 255, 0.12); overflow: hidden;
  }
  .fill { height: 100%; background: var(--c); border-radius: 999px; }
  .task.drain .fill { background: #ef4444; }
  .phint {
    font-size: 11px; color: #cbd5e1; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    font-family: system-ui, "Microsoft JhengHei", sans-serif; white-space: nowrap;
  }
  .task.drain .phint { color: #fca5a5; font-weight: 700; }

  .distract {
    position: absolute; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    pointer-events: none;
  }
  .dicon {
    width: 58px; height: 58px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 30px;
    background: rgba(239, 68, 68, 0.16); border: 2px solid #ef4444;
    animation: buzz 0.8s ease infinite;
  }
  @keyframes buzz {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
    50% { transform: scale(1.1); box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
  }
  .dlabel {
    font-size: 11px; color: #fca5a5; white-space: nowrap;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  }

  .hud {
    position: fixed; top: 0; left: 0; right: 0; padding: 14px 100px 14px 18px;
    display: flex; flex-direction: column; gap: 6px; pointer-events: none;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    color: #f1f5f9; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  }
  .row { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; row-gap: 4px; }
  .lv { font-size: 14px; font-weight: 700; color: #f59e0b; }
  .timer { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .best { font-size: 13px; color: #fcd34d; }
  .count { font-size: 14px; margin-left: auto; font-weight: 700; }
  .shelf-row { display: flex; gap: 6px; }
  .shelf-icon {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 17px;
    background: var(--c); box-shadow: 0 0 10px -2px var(--c);
    animation: shelf-pop 0.4s ease;
  }
  @keyframes shelf-pop { 0% { transform: scale(1.4); } 100% { transform: scale(1); } }
  .task-desc { font-size: 13px; color: #aeb8c8; max-width: 640px; }

  @media (max-width: 480px) {
    .hud { padding: 10px 78px 10px 14px; }
    .timer { font-size: 24px; }
    .task-desc { font-size: 11.5px; }
  }

  .overlay {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    background: rgba(8, 10, 16, 0.74); backdrop-filter: blur(6px); padding: 20px;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
  }
  .panel {
    background: #12141c; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px;
    padding: 26px 32px; text-align: center; color: #e2e8f0; max-width: 380px;
  }
  .panel h1 { font-size: 22px; margin-bottom: 8px; }
  .big { font-size: 18px; color: #cbd5e1; margin-bottom: 4px; }
  .big b { color: #f59e0b; font-size: 22px; }
  .small { font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  .cost { font-size: 13px; color: #94a3b8; margin: 8px 0 18px; }
  .btns { display: flex; gap: 10px; justify-content: center; }
  .primary {
    padding: 12px 28px; border: none; border-radius: 999px; background: #f59e0b;
    color: #1a1206; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer;
  }
  .ghost {
    padding: 12px 22px; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 999px;
    background: transparent; color: #e2e8f0; font-size: 15px; font-family: inherit; cursor: pointer;
  }
  .primary:active, .ghost:active { transform: scale(0.98); }
</style>
