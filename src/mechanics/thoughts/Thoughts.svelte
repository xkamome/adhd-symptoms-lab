<script lang="ts">
  // 念頭插隊：主管只講一次，講完一句那句就消失；腦中的念頭一直浮上來蓋住畫面。
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import Debrief from '../../shared/Debrief.svelte'
  import { makeBriefing, THOUGHTS, type Briefing } from './script'

  const LINE_GAP = 1.9 // 每句間隔（秒）
  const LINE_SHOW = 1.55 // 一句話留在畫面上的時間，之後就消失
  const SPAWN_MIN = 0.5
  const SPAWN_MAX = 1.1
  const CHAIN_P = 0.55 // 趕走一個念頭，牽出下一個的機率

  type Bubble = { id: number; text: string; x: number; y: number; vx: number; life: number; max: number }

  let phase = $state<'intro' | 'talk' | 'quiz' | 'done'>('intro')
  let brief = $state<Briefing>(makeBriefing())
  let lineIdx = $state(-1)
  let lineVisible = $state(false)
  let bubbles = $state<Bubble[]>([])
  let popped = $state(0)
  let qi = $state(0)
  let score = $state(0)
  // KEY 要在 loadBest() 被呼叫前宣告（曾在 outofsight 踩過 TDZ）
  const KEY = 'thoughts-best'
  function loadBest(): number {
    try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 }
  }
  let best = $state(loadBest())

  let area: HTMLDivElement
  let nextId = 0
  let lineT = 0
  let spawnT = 0.8
  let endT = 0

  function start() {
    brief = makeBriefing()
    lineIdx = -1; lineVisible = false; lineT = 0.6
    bubbles = []; popped = 0; qi = 0; score = 0
    spawnT = 0.8; endT = 0
    phase = 'talk'
  }

  function spawn(text: string, x?: number, y?: number) {
    const r = area.getBoundingClientRect()
    const w = Math.min(320, text.length * 24 + 60)
    bubbles.push({
      id: nextId++, text,
      x: x ?? r.left + Math.random() * Math.max(10, r.width - w),
      y: y ?? r.top + r.height * (0.1 + Math.random() * 0.75),
      vx: (Math.random() - 0.5) * 20, life: 0, max: 6 + Math.random() * 3,
    })
  }

  function pop(b: Bubble) {
    if (phase !== 'talk') return
    popped++
    bubbles = bubbles.filter((o) => o.id !== b.id)
    const pair = THOUGHTS.find((t) => t[0] === b.text)
    if (pair && Math.random() < CHAIN_P) {
      setTimeout(() => { if (phase === 'talk') spawn(pair[1], b.x + (Math.random() - 0.5) * 80, b.y - 30 - Math.random() * 40) }, 250)
    }
  }

  function answer(opt: string) {
    if (opt === brief.quiz[qi].answer) score++
    qi++
    if (qi >= brief.quiz.length) {
      phase = 'done'
      if (score > best) { best = score; try { localStorage.setItem(KEY, String(score)) } catch {} }
    }
  }

  onMount(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (phase === 'talk') step(dt)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  })

  function step(dt: number) {
    lineT -= dt
    if (lineVisible && lineT < LINE_GAP - LINE_SHOW) lineVisible = false
    if (lineT <= 0) {
      if (lineIdx + 1 < brief.lines.length) {
        lineIdx++; lineVisible = true; lineT = LINE_GAP
      } else {
        endT += dt
        if (endT > 1.2) { bubbles = []; phase = 'quiz'; return }
      }
    }
    spawnT -= dt
    if (spawnT <= 0) {
      spawnT = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
      spawn(THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)][0])
    }
    for (const b of bubbles) { b.life += dt; b.y -= dt * 10; b.x += b.vx * dt }
    if (bubbles.some((b) => b.life >= b.max)) bubbles = bubbles.filter((b) => b.life < b.max)
  }

  const bubbleStyle = (b: Bubble) => {
    const sc = 0.85 + 0.3 * Math.min(1, b.life / 3)
    const op = Math.min(1, b.life * 3) * Math.min(1, (b.max - b.life) * 2)
    return `transform: translate(${b.x}px, ${b.y}px) scale(${sc}); opacity: ${op}`
  }
</script>

<div class="page">
  <div class="boss">
    <span class="emo">👩‍💼</span>
    <span>主管正在交代事情。<b>她只講一次。</b></span>
  </div>

  <div class="talk" bind:this={area}>
    {#if phase === 'talk' && lineVisible && lineIdx >= 0}
      {#key lineIdx}
        <p class="line" in:fade={{ duration: 120 }} out:fade={{ duration: 300 }}>{brief.lines[lineIdx]}</p>
      {/key}
    {/if}
    {#if phase === 'talk'}
      <span class="progress">{Math.max(0, lineIdx + 1)} / {brief.lines.length}</span>
    {/if}
  </div>
</div>

{#each bubbles as b (b.id)}
  <button class="bubble" style={bubbleStyle(b)} onpointerdown={() => pop(b)}>💭 {b.text}</button>
{/each}

{#if phase === 'intro'}
  <div class="overlay">
    <div class="box">
      <h2>念頭插隊</h2>
      <p>主管要交代一件事，講完會考你內容。<br />她每講完一句，那句話就不見了——就像真的對話一樣，不能倒帶。</p>
      <p class="muted">你的腦袋會一直冒出念頭。點一下可以把它趕走。</p>
      <button class="primary" onclick={start}>開始</button>
    </div>
  </div>
{:else if phase === 'quiz'}
  <div class="overlay">
    <div class="box">
      <p class="muted">第 {qi + 1} / {brief.quiz.length} 題</p>
      <h2>{brief.quiz[qi].q}</h2>
      <div class="opts">
        {#each brief.quiz[qi].options as o}
          <button class="opt" onclick={() => answer(o)}>{o}</button>
        {/each}
      </div>
    </div>
  </div>
{:else if phase === 'done'}
  <Debrief
    title="答對 {score} / {brief.quiz.length} 題"
    myth="沒在聽、不尊重人、左耳進右耳出。"
    truth="ADHD 的大腦很難把「不相關的念頭」擋在門外——它們會自己冒出來，而且一個牽出下一個。不是不想聽，是每一句話都得跟腦中的聲音搶位置。事後被問「我剛剛不是講過了？」，是最常聽到的一句話。"
    onretry={start}
  >
    <p>你趕走了 <b>{popped}</b> 個念頭——每趕一個，就少聽一句</p>
    <p>最佳紀錄：答對 <b>{best}</b> 題</p>
    <p>{score < 4 ? '你明明很認真在聽，對吧？' : '記住了！但你有多累？'}</p>
  </Debrief>
{/if}

<style>
  .page { position: fixed; inset: 0; background: var(--panel2); display: grid; grid-template-rows: auto 1fr; gap: 14px; padding: 60px 16px 16px; }
  .boss { display: flex; gap: 12px; align-items: center; color: var(--muted); }
  .boss b { color: var(--text); }
  .emo { font-family: var(--emoji); font-size: 44px; }
  .talk {
    position: relative; background: #f2eee6; color: #2a2433; border-radius: 14px;
    display: grid; place-items: center; padding: 24px; overflow: hidden;
  }
  .line { grid-area: 1 / 1; font-size: clamp(24px, 4.2vw, 40px); font-weight: 700; text-align: center; line-height: 1.5; text-wrap: balance; }
  .progress { position: absolute; right: 14px; bottom: 10px; font-size: 12px; color: #8a8298; font-variant-numeric: tabular-nums; }

  .bubble {
    position: fixed; left: 0; top: 0; z-index: 20; transform-origin: center;
    background: #fff; color: #2a2433; border: 0; border-radius: 999px;
    padding: 14px 24px; font: inherit; font-size: clamp(19px, 2.6vw, 24px); font-weight: 700; white-space: nowrap;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.4); cursor: pointer; touch-action: manipulation;
  }

  .overlay { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; background: rgb(14 11 22 / 0.88); padding: 18px; }
  .box { max-width: 520px; width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 22px; display: grid; gap: 12px; line-height: 1.65; }
  h2 { font-size: 22px; font-weight: 900; }
  .muted { color: var(--muted); }
  .primary { justify-self: start; font: inherit; font-weight: 700; padding: 10px 22px; border: 0; border-radius: 10px; background: var(--accent); color: var(--bg); cursor: pointer; }
  .opts { display: grid; gap: 8px; }
  .opt { text-align: left; font: inherit; padding: 11px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel2); color: var(--text); cursor: pointer; }
  .opt:hover { border-color: var(--accent); }
</style>
