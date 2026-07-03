<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  // 待辦清單：15 秒內盡量完成，平常按下去要等 2 秒才會生效（慢半拍）。
  // 同時處理太多件（3 件以上一起等待生效）會直接「當機」1 秒——模擬 ADHD 同時多工會直接卡死。
  // 有幾項作業其實要重複做 2~3 次才算完成。剩最後 5 秒起，延遲會連續變快，越接近 0 秒反應越靈敏。
  const CHORE_DEFS = [
    { emoji: '🍽️', label: '洗碗' },
    { emoji: '📧', label: '回信' },
    { emoji: '🗑️', label: '倒垃圾' },
    { emoji: '👕', label: '摺衣服' },
    { emoji: '🪴', label: '澆花' },
    { emoji: '📦', label: '拆包裹' },
    { emoji: '🧹', label: '掃地' },
    { emoji: '💡', label: '換燈泡' },
  ]

  const TOTAL = 15
  const URGENT_AT = 5 // 剩最後 5 秒起，延遲開始漸漸變短
  const NORMAL_DELAY = 2 // 平常按下去要等這麼久才生效
  const MIN_DELAY = 0.12 // 時間快到 0 時，延遲趨近這個下限
  const MAX_CONCURRENT = 2 // 同時等待生效超過這個數，第 3 件會觸發 panic
  const PANIC_LOCK = 1 // panic 卡住幾秒
  const REP_CHORES = 3 // 有幾項作業需要重複做才算完成

  // 平常固定延遲；進入最後 URGENT_AT 秒後，延遲隨剩餘時間線性遞減到 MIN_DELAY
  function delayFor(rem: number): number {
    if (rem > URGENT_AT) return NORMAL_DELAY
    const t = Math.max(0, rem) / URGENT_AT
    return MIN_DELAY + (NORMAL_DELAY - MIN_DELAY) * t
  }

  const KEY = 'urgency-best'
  function loadBest(): number | null {
    const v = Number(localStorage.getItem(KEY))
    return v > 0 ? v : null
  }

  interface Chore { emoji: string; label: string; done: boolean; pending: boolean; repsNeeded: number; repsDone: number }

  function freshChores(): Chore[] {
    const idx = [...CHORE_DEFS.keys()].sort(() => Math.random() - 0.5).slice(0, REP_CHORES)
    return CHORE_DEFS.map((c, i) => ({
      ...c, done: false, pending: false,
      repsNeeded: idx.includes(i) ? 2 + Math.floor(Math.random() * 2) : 1,
      repsDone: 0,
    }))
  }

  let started = $state(false)
  let chores = $state<Chore[]>(freshChores())
  let remaining = $state(TOTAL)
  let urgent = $state(false)
  let ended = $state(false)
  let normalDone = $state(0)
  let urgentDone = $state(0)
  let bestNormalDone = $state<number | null>(loadBest())
  let panicked = $state(false)
  let panicUntil = $state(0)

  const doneCount = $derived(chores.filter((c) => c.done).length)
  const allDone = $derived(doneCount === chores.length)
  const pendingCount = $derived(chores.filter((c) => c.pending).length)

  let raf = 0
  let last = performance.now()
  let timers: number[] = []

  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (started && !ended) {
      remaining = Math.max(0, remaining - dt)
      urgent = remaining <= URGENT_AT
      if (panicked) {
        panicUntil -= dt
        if (panicUntil <= 0) panicked = false
      }
      if (remaining <= 0 || allDone) endRound()
    }
    raf = requestAnimationFrame(tick)
  }

  function click(i: number) {
    if (!started || ended || panicked || chores[i].done || chores[i].pending) return
    if (pendingCount >= MAX_CONCURRENT) {
      // 同時塞太多件：直接 panic，正在等待的都算失敗要重來
      panicked = true
      panicUntil = PANIC_LOCK
      for (const c of chores) if (c.pending) c.pending = false
      return
    }
    const wasUrgent = urgent
    chores[i].pending = true
    const t = window.setTimeout(() => {
      if (ended) return
      chores[i].pending = false
      chores[i].repsDone++
      if (chores[i].repsDone >= chores[i].repsNeeded) {
        chores[i].done = true
        if (wasUrgent) urgentDone++
        else normalDone++
      }
    }, delayFor(remaining) * 1000)
    timers.push(t)
  }

  function endRound() {
    if (ended) return
    ended = true
    const total = normalDone + urgentDone
    if (bestNormalDone === null || total > bestNormalDone) {
      bestNormalDone = total
      localStorage.setItem(KEY, String(total))
    }
  }

  function beginGame() {
    started = true
    last = performance.now()
  }

  function restart() {
    for (const t of timers) clearTimeout(t)
    timers = []
    chores = freshChores()
    remaining = TOTAL
    urgent = false
    ended = false
    started = false
    panicked = false
    normalDone = 0
    urgentDone = 0
  }

  onMount(() => { raf = requestAnimationFrame(tick) })
  onDestroy(() => { cancelAnimationFrame(raf); for (const t of timers) clearTimeout(t) })

  const fmt = (s: number) => Math.ceil(s).toString()
</script>

<div class="arena" class:urgent class:panicked>
  <div class="grid">
    {#each chores as c, i}
      <button class="chore" class:done={c.done} class:pending={c.pending} onclick={() => click(i)} disabled={c.done}>
        <span class="cicon">{c.done ? '✅' : c.emoji}</span>
        <span class="clabel">{c.label}</span>
        {#if c.repsNeeded > 1 && !c.done}<span class="reps">{c.repsDone}/{c.repsNeeded}</span>{/if}
        {#if c.pending}<span class="spinner"></span>{/if}
      </button>
    {/each}
  </div>
  {#if panicked}
    <div class="panic-flash">⚠️ 當機了！同時處理太多件</div>
  {/if}
</div>

<div class="hud">
  <div class="row">
    <span class="timer" class:hot={urgent}>{fmt(remaining)}s</span>
    {#if bestNormalDone !== null}<span class="best">最佳完成 {bestNormalDone} 件</span>{/if}
    <span class="count">完成 {doneCount} / {chores.length}</span>
  </div>
  <div class="task-desc">
    {#if urgent}
      腎上腺素上身——越接近 0 秒，按下去反應越快。
    {:else}
      平常按下去要等 {NORMAL_DELAY}s 才會生效；同時等超過 {MAX_CONCURRENT} 件會當機卡住 {PANIC_LOCK}s；有些要重複做好幾次才算完成。
    {/if}
  </div>
</div>

{#if !started}
  <div class="overlay">
    <div class="panel">
      <h1>你今天有好多事要做</h1>
      <p class="cost">
        每件事按下去都要等 {NORMAL_DELAY} 秒才會生效——但同時處理超過 {MAX_CONCURRENT} 件，會直接當機卡住 {PANIC_LOCK} 秒。
        有幾項其實得重複做 2～3 次才算真的完成。剩最後 {URGENT_AT} 秒時，速度會變得非常快。
      </p>
      <button class="primary" onclick={beginGame}>開始</button>
    </div>
  </div>
{:else if ended}
  <div class="overlay">
    <div class="panel">
      <h1>{allDone ? '待辦都做完了' : '時間到'}</h1>
      <p class="big">平常完成 <b>{normalDone}</b> 件・最後 {URGENT_AT} 秒完成 <b>{urgentDone}</b> 件</p>
      {#if bestNormalDone !== null}<p class="small">最佳總完成 {bestNormalDone} 件</p>{/if}
      <p class="cost">是不是覺得最後那幾秒特別「上手」？平常的慢半拍，跟迫在眉睫時的瞬間反應，是同一個大腦。</p>
      <button class="primary" onclick={restart}>再玩一次</button>
    </div>
  </div>
{/if}

<style>
  .arena {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    padding: 24px; transition: background 0.4s ease;
    background: radial-gradient(ellipse at center, #161a24 0%, #0a0c12 100%);
  }
  .arena.urgent { background: radial-gradient(ellipse at center, #3a1414 0%, #150808 100%); }
  .arena.panicked { animation: panic-shake 0.15s ease infinite; }
  @keyframes panic-shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }

  .grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
    max-width: 560px; width: 100%;
  }
  .chore {
    position: relative;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 16px 8px; border-radius: 16px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    color: #e2e8f0; transition: transform 0.1s, border-color 0.2s;
  }
  .chore:active:not(:disabled) { transform: scale(0.95); }
  .chore.pending { border-color: #fbbf24; opacity: 0.75; }
  .chore.done { border-color: #4ade80; background: rgba(74, 222, 128, 0.1); cursor: default; }
  .cicon { font-size: 30px; }
  .clabel { font-size: 12px; }
  .reps { font-size: 10px; color: #93c5fd; font-weight: 700; }
  .spinner {
    position: absolute; top: 6px; right: 6px; width: 10px; height: 10px;
    border-radius: 50%; border: 2px solid rgba(251, 191, 36, 0.35); border-top-color: #fbbf24;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .panic-flash {
    position: absolute; top: 46%; left: 50%; transform: translate(-50%, -50%);
    font-size: 22px; font-weight: 800; color: #fca5a5;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7); pointer-events: none;
  }

  .hud {
    position: fixed; top: 0; left: 0; right: 0; padding: 14px 18px;
    display: flex; flex-direction: column; gap: 6px; pointer-events: none;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    color: #f1f5f9; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  }
  .row { display: flex; align-items: baseline; gap: 16px; }
  .timer { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .timer.hot { color: #ef4444; animation: pulse 0.5s ease infinite; }
  @keyframes pulse { 50% { transform: scale(1.12); } }
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
    padding: 26px 32px; text-align: center; color: #e2e8f0; max-width: 380px;
  }
  .panel h1 { font-size: 22px; margin-bottom: 8px; }
  .big { font-size: 16px; color: #cbd5e1; margin-bottom: 4px; }
  .big b { color: #f59e0b; font-size: 18px; }
  .small { font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  .cost { font-size: 13px; color: #94a3b8; margin: 8px 0 18px; line-height: 1.6; }
  .primary {
    padding: 12px 28px; border: none; border-radius: 999px; background: #f59e0b;
    color: #1a1206; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer;
  }
  .primary:active { transform: scale(0.98); }
</style>
