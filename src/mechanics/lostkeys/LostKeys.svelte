<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  // 物件恆存失靈：把鑰匙放在一件家具上、記住它 → 被打斷做別的事 → 回頭家具悄悄重排位置。
  // 「我很確定就在那」的自信，會被一個殘影（原本畫面位置的淡淡提示）狠狠誤導。
  const FURNITURE = [
    { emoji: '🛋️', label: '沙發' },
    { emoji: '📚', label: '書架' },
    { emoji: '👞', label: '鞋櫃' },
    { emoji: '🪟', label: '窗台' },
    { emoji: '🗄️', label: '抽屜' },
    { emoji: '🛏️', label: '床頭櫃' },
  ]
  const SLOTS = [
    { x: 20, y: 34 }, { x: 50, y: 30 }, { x: 80, y: 36 },
    { x: 22, y: 70 }, { x: 50, y: 74 }, { x: 78, y: 70 },
  ]
  const ROUNDS = 5
  const PLACE_TIME = 1.6
  const N_BLIPS = 3

  type Phase = 'place' | 'distract' | 'ghost' | 'search' | 'done'

  function shuffled(n: number): number[] {
    const a = Array.from({ length: n }, (_, i) => i)
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
    return a
  }

  let arena: HTMLDivElement
  let round = $state(0)
  let phase = $state<Phase>('place')
  let perm = $state<number[]>(shuffled(6)) // perm[furnitureId] = slotIndex
  let keyHolder = $state(0)
  let ghostSlot = $state<number | null>(null)
  let wrongFlash = $state<number | null>(null)
  let phaseTimer = $state(0)
  let totalWrong = $state(0)
  let blips = $state<{ x: number; y: number; life: number; max: number }[]>([])
  let ended = $state(false)

  const KEY = 'lostkeys-best'
  function loadBest(): number | null { const v = Number(localStorage.getItem(KEY)); return v > 0 ? v : null }
  let bestWrong = $state<number | null>(loadBest())

  function startRound(r: number) {
    round = r
    perm = shuffled(6)
    keyHolder = Math.floor(Math.random() * 6)
    phase = 'place'
    phaseTimer = PLACE_TIME
    blips = []
  }

  function goToDistract() {
    phase = 'distract'
    phaseTimer = 0
    blips = []
  }

  function goToGhost() {
    ghostSlot = perm[keyHolder]
    let np = shuffled(6)
    // 確保鑰匙那件家具真的換了位置——不然就沒有「誤導」可言
    while (np[keyHolder] === ghostSlot) np = shuffled(6)
    perm = np
    phase = 'ghost'
    phaseTimer = 1.1
  }

  function goToSearch() {
    phase = 'search'
  }

  function clickSlot(slotIdx: number) {
    if (phase !== 'search') return
    if (perm[keyHolder] === slotIdx) {
      if (round + 1 >= ROUNDS) {
        phase = 'done'; ended = true
        if (bestWrong === null || totalWrong < bestWrong) { bestWrong = totalWrong; localStorage.setItem(KEY, String(totalWrong)) }
      } else {
        startRound(round + 1)
      }
    } else {
      totalWrong++
      wrongFlash = slotIdx
      setTimeout(() => { wrongFlash = null }, 300)
    }
  }

  function restart() {
    totalWrong = 0
    ended = false
    startRound(0)
  }

  let raf = 0
  let last = performance.now()
  let blipTimer = 0.8

  function spawnBlip() {
    blips = [...blips, { x: 10 + Math.random() * 80, y: 10 + Math.random() * 15, life: 1.8, max: 1.8 }]
  }

  function clickBlip(i: number) {
    blips = blips.filter((_, idx) => idx !== i)
  }

  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!ended) {
      if (phase === 'place') {
        phaseTimer -= dt
        if (phaseTimer <= 0) goToDistract()
      } else if (phase === 'distract') {
        blipTimer -= dt
        if (blipTimer <= 0 && blips.length < N_BLIPS) { spawnBlip(); blipTimer = 0.7 + Math.random() * 0.5 }
        for (let i = blips.length - 1; i >= 0; i--) {
          blips[i].life -= dt
          if (blips[i].life <= 0) blips.splice(i, 1)
        }
        blips = blips
        if (blips.length === 0 && blipTimer <= 0.71) goToGhost()
      } else if (phase === 'ghost') {
        phaseTimer -= dt
        if (phaseTimer <= 0) goToSearch()
      }
    }
    raf = requestAnimationFrame(tick)
  }

  onMount(() => { raf = requestAnimationFrame(tick) })
  onDestroy(() => cancelAnimationFrame(raf))
</script>

<div class="arena" bind:this={arena}>
  {#each FURNITURE as f, id}
    {@const slot = SLOTS[perm[id]]}
    <button
      class="spot"
      class:wrong={wrongFlash === perm[id]}
      class:searching={phase === 'search'}
      style="left:{slot.x}%; top:{slot.y}%"
      onclick={() => clickSlot(perm[id])}
      disabled={phase !== 'search'}
    >
      <span class="ficon">{f.emoji}</span>
      <span class="flabel">{f.label}</span>
      {#if phase === 'place' && id === keyHolder}<span class="key">🔑</span>{/if}
    </button>
  {/each}

  {#if phase === 'ghost' && ghostSlot !== null}
    {@const g = SLOTS[ghostSlot]}
    <div class="ghost" style="left:{g.x}%; top:{g.y}%">
      <span class="gkey">🔑</span>
      <span class="glabel">你確定是這裡…？</span>
    </div>
  {/if}

  {#each blips as b, i}
    <button class="blip" style="left:{b.x}%; top:{b.y}%; opacity:{Math.min(1, b.life / b.max)}" onclick={() => clickBlip(i)}>📩</button>
  {/each}
</div>

<div class="hud">
  <div class="row">
    <span class="lv">第 {round + 1}/{ROUNDS} 輪</span>
    <span class="wrong">翻找錯誤 {totalWrong} 次</span>
    {#if bestWrong !== null}<span class="best">最佳 {bestWrong} 次</span>{/if}
  </div>
  <div class="task-desc">
    {#if phase === 'place'}記住鑰匙 🔑 放在哪件家具上。
    {:else if phase === 'distract'}先處理這些通知（點掉它們）——你正在被打斷。
    {:else if phase === 'ghost'}家具重新排過了……鑰匙還在原本那個位置嗎？
    {:else if phase === 'search'}鑰匙在哪件家具上？點它。
    {/if}
  </div>
</div>

{#if ended}
  <div class="overlay">
    <div class="panel">
      <h1>{ROUNDS} 輪都找完了</h1>
      <p class="big">總共翻找錯誤 <b>{totalWrong}</b> 次</p>
      {#if bestWrong !== null}<p class="small">最佳 {bestWrong} 次</p>{/if}
      <p class="cost">你有沒有發現——「我很確定放在那」的自信，跟實際位置常常對不上？家具沒有變，只是你腦中的地圖跟不上現實重排的速度。</p>
      <button class="primary" onclick={restart}>再玩一次</button>
    </div>
  </div>
{/if}

<style>
  .arena { position: fixed; inset: 0; overflow: hidden; }
  .spot {
    position: absolute; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    width: 130px; padding: 18px 10px; border-radius: 18px; cursor: default;
    border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.04);
    font-family: system-ui, "Microsoft JhengHei", sans-serif; color: #e2e8f0;
    transition: left 0.5s cubic-bezier(.2,.8,.2,1), top 0.5s cubic-bezier(.2,.8,.2,1), border-color 0.2s;
  }
  .spot.searching { cursor: pointer; border-color: rgba(245, 158, 11, 0.4); }
  .spot.searching:active { transform: translate(-50%, -50%) scale(0.95); }
  .spot.wrong { border-color: #ef4444; animation: shake 0.3s ease; }
  @keyframes shake { 25% { transform: translate(-52%, -50%); } 75% { transform: translate(-48%, -50%); } }
  .ficon { font-size: 40px; }
  .flabel { font-size: 12px; color: #9aa6b8; }
  /* left:50% + transform 保持在 spot 中心正上方；spot 位移用 CSS transition 移動時，
     key 是 spot 的子元素會跟著一起飄過去——bob 動畫的 keyframe 需要一起帶著 translateX(-50%) */
  .key { position: absolute; top: -16px; left: 50%; font-size: 22px; animation: bob 1s ease-in-out infinite; }
  @keyframes bob { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -4px); } }

  .ghost {
    position: absolute; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    opacity: 0.45; pointer-events: none;
    animation: fadeout 1.1s ease forwards;
  }
  @keyframes fadeout { 0% { opacity: 0.6; } 100% { opacity: 0; } }
  .gkey { font-size: 26px; filter: grayscale(0.6); }
  .glabel {
    font-size: 11px; color: #cbd5e1; white-space: nowrap;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
  }

  .blip {
    position: absolute; transform: translate(-50%, -50%);
    width: 40px; height: 40px; border-radius: 50%; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #fbbf24; background: rgba(251, 191, 36, 0.15); cursor: pointer;
  }

  .hud {
    position: fixed; top: 0; left: 0; right: 0; padding: 14px 18px;
    display: flex; flex-direction: column; gap: 6px; pointer-events: none;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    color: #f1f5f9; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  }
  .row { display: flex; align-items: baseline; gap: 16px; }
  .lv { font-size: 14px; font-weight: 700; color: #f59e0b; }
  .wrong { font-size: 14px; font-weight: 700; }
  .best { font-size: 13px; color: #fcd34d; }
  .task-desc { font-size: 13px; color: #aeb8c8; max-width: 640px; }

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
  .big { font-size: 16px; color: #cbd5e1; margin-bottom: 4px; }
  .big b { color: #f59e0b; font-size: 20px; }
  .small { font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  .cost { font-size: 13px; color: #94a3b8; margin: 8px 0 18px; }
  .primary {
    padding: 12px 28px; border: none; border-radius: 999px; background: #f59e0b;
    color: #1a1206; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer;
  }
  .primary:active { transform: scale(0.98); }
</style>
