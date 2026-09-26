<script lang="ts">
  // 念頭插隊：有人交代事情，只講一次；腦中的念頭一直浮上來蓋住畫面。
  // 難度只改「講過的話留多久」——簡單一直留著、普通慢慢淡掉、困難講一句消失一句。
  // 念頭的量三種難度都一樣，差別只在能不能「倒帶」；困難模式另外有會搗蛋的特殊泡泡。
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import Debrief from '../../shared/Debrief.svelte'
  import { getStage, rectInStage } from '../../shared/stage'
  import { makeBriefing, NOTIFICATIONS, THOUGHTS, type Briefing } from './script'

  type Difficulty = 'easy' | 'normal' | 'hard'
  const LEVELS: { id: Difficulty; name: string; desc: string }[] = [
    { id: 'easy', name: '簡單', desc: '講過的話會一直留在畫面上' },
    { id: 'normal', name: '普通', desc: '講過的話會慢慢淡掉' },
    { id: 'hard', name: '困難', desc: '講一句消失一句，念頭還會搗蛋' },
  ]

  const LINE_GAP = 1.9 // 每句間隔（秒）
  const LINE_SHOW = 1.55 // 困難：一句話留在畫面上的時間，之後就消失
  const FADE_HOLD = 1.5 // 普通：一句話完整停留的時間
  const FADE_OUT = 7 // 普通：之後淡到看不見所花的時間
  const SPAWN_MIN = 0.5
  const SPAWN_MAX = 1.1
  const CHAIN_P = 0.55 // 趕走一個念頭，牽出下一個的機率
  const SCENE_P = 0.35 // 念頭來自情境專屬清單的機率
  const SPECIAL_P = 0.35 // 困難模式：冒出特殊泡泡的機率

  // split 點了分裂成兩個、dodge 會閃開、stubborn 要點兩下、notify 手機通知、grow 慢慢膨脹擋字
  type Kind = 'normal' | 'split' | 'dodge' | 'stubborn' | 'notify' | 'grow'
  const SPECIALS: Kind[] = ['split', 'dodge', 'stubborn', 'notify', 'grow']
  type Bubble = {
    id: number; text: string; next?: string; kind: Kind; hp: number; small: boolean
    x: number; y: number; vx: number; vy: number; life: number; max: number; shake: number
  }
  type Shown = { i: number; at: number }

  const stage = getStage()

  let phase = $state<'intro' | 'talk' | 'quiz' | 'done'>('intro')
  let difficulty = $state<Difficulty>('hard')
  let brief = $state<Briefing>(makeBriefing())
  let lineIdx = $state(-1)
  let lineVisible = $state(false)
  let shown = $state<Shown[]>([])
  let talkT = $state(0)
  let bubbles = $state<Bubble[]>([])
  let popped = $state(0)
  let qi = $state(0)
  let score = $state(0)

  // 最佳紀錄分難度記；困難沿用改版前的舊紀錄
  const key = (d: Difficulty) => `thoughts-best-${d}`
  function loadBest(d: Difficulty): number {
    try { return Number(localStorage.getItem(key(d)) ?? (d === 'hard' ? localStorage.getItem('thoughts-best') : 0)) || 0 } catch { return 0 }
  }
  let best = $state<Record<Difficulty, number>>({ easy: loadBest('easy'), normal: loadBest('normal'), hard: loadBest('hard') })

  let area: HTMLDivElement
  let nextId = 0
  let lineT = 0
  let spawnT = 0.8
  let endT = 0

  const levelName = $derived(LEVELS.find((l) => l.id === difficulty)!.name)

  function start(d: Difficulty = difficulty) {
    difficulty = d
    brief = makeBriefing()
    lineIdx = -1; lineVisible = false; lineT = 0.6
    shown = []; talkT = 0
    bubbles = []; popped = 0; qi = 0; score = 0
    spawnT = 0.8; endT = 0
    phase = 'talk'
  }

  function randomThought() {
    const pool = Math.random() < SCENE_P ? brief.scenario.thoughts : THOUGHTS
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function spawn(kind: Kind, text: string, next?: string, at?: { x: number; y: number }, small = false) {
    const r = rectInStage(area)
    const w = kind === 'notify' ? 380 : Math.min(r.width - 20, text.length * (small ? 16 : 21) + 70)
    let x = r.left + Math.random() * Math.max(10, r.width - w)
    let y = r.top + r.height * (0.1 + Math.random() * 0.75)
    let vx = (Math.random() - 0.5) * 20, vy = -10, max = 6 + Math.random() * 3
    if (kind === 'notify') { y = r.top + 16 + Math.random() * r.height * 0.3; vx = 0; vy = 0; max = 4.5 }
    if (kind === 'grow') { x = r.left + (r.width - w) / 2 + (Math.random() - 0.5) * 160; y = r.top + r.height * (0.35 + Math.random() * 0.2); vy = -3; max = 9 }
    if (at) { x = at.x; y = at.y }
    bubbles.push({
      id: nextId++, text, next, kind, small, hp: kind === 'stubborn' ? 2 : kind === 'dodge' ? 2 : 1,
      x, y, vx, vy, life: 0, max, shake: 0,
    })
  }

  function spawnRandom() {
    if (difficulty === 'hard' && Math.random() < SPECIAL_P) {
      const kind = SPECIALS[Math.floor(Math.random() * SPECIALS.length)]
      if (kind === 'notify') { spawn('notify', NOTIFICATIONS[Math.floor(Math.random() * NOTIFICATIONS.length)]); return }
      const th = randomThought()
      spawn(kind, th.text, th.next)
      return
    }
    const th = randomThought()
    spawn('normal', th.text, th.next)
  }

  /** 閃躲：跳到文字區的另一個位置 */
  function dodge(b: Bubble) {
    const r = rectInStage(area)
    const w = b.text.length * 21 + 70
    b.x = r.left + Math.random() * Math.max(10, r.width - w)
    b.y = r.top + r.height * (0.1 + Math.random() * 0.75)
    b.hp--
  }

  function onEnter(b: Bubble, e: PointerEvent) {
    // 滑鼠才閃；觸控沒有「靠近」這回事，改在按下時閃
    if (phase === 'talk' && b.kind === 'dodge' && b.hp > 1 && e.pointerType === 'mouse') dodge(b)
  }

  function pop(b: Bubble) {
    if (phase !== 'talk') return
    if (b.kind === 'dodge' && b.hp > 1) { dodge(b); return }
    if (b.kind === 'stubborn' && b.hp > 1) {
      b.hp--; b.shake = 0.45; b.life = Math.min(b.life, 1)
      if (b.next) { b.text = b.next; b.next = undefined } else b.text += '（不走）'
      return
    }
    popped++
    bubbles = bubbles.filter((o) => o.id !== b.id)
    if (b.kind === 'split') {
      for (const dx of [-70, 70]) {
        const th = randomThought()
        spawn('normal', th.text, undefined, { x: b.x + dx, y: b.y + (Math.random() - 0.5) * 40 }, true)
      }
      return
    }
    if (b.next && Math.random() < CHAIN_P) {
      const next = b.next
      setTimeout(() => {
        if (phase === 'talk') spawn('normal', next, undefined, { x: b.x + (Math.random() - 0.5) * 80, y: b.y - 30 - Math.random() * 40 })
      }, 250)
    }
  }

  function answer(opt: string) {
    if (opt === brief.quiz[qi].answer) score++
    qi++
    if (qi >= brief.quiz.length) {
      phase = 'done'
      if (score > best[difficulty]) {
        best[difficulty] = score
        try { localStorage.setItem(key(difficulty), String(score)) } catch {}
      }
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
    talkT += dt
    lineT -= dt
    if (difficulty === 'hard' && lineVisible && lineT < LINE_GAP - LINE_SHOW) lineVisible = false
    if (lineT <= 0) {
      if (lineIdx + 1 < brief.lines.length) {
        lineIdx++; lineVisible = true; lineT = LINE_GAP
        shown.push({ i: lineIdx, at: talkT })
      } else {
        endT += dt
        if (endT > 1.2) { bubbles = []; phase = 'quiz'; return }
      }
    }
    spawnT -= dt
    if (spawnT <= 0) {
      spawnT = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
      spawnRandom()
    }
    for (const b of bubbles) {
      b.life += dt; b.y += b.vy * dt; b.x += b.vx * dt
      if (b.shake > 0) b.shake -= dt
    }
    if (bubbles.some((b) => b.life >= b.max)) bubbles = bubbles.filter((b) => b.life < b.max)
  }

  /** 普通難度：一句話出現後先停一下，再慢慢淡掉 */
  const fadeOf = (s: Shown) => {
    const age = talkT - s.at
    return age < FADE_HOLD ? 1 : Math.max(0, 1 - (age - FADE_HOLD) / FADE_OUT)
  }

  const bubbleStyle = (b: Bubble) => {
    const grow = b.kind === 'grow' ? 0.9 + 1.1 * (b.life / b.max) : 0.85 + 0.3 * Math.min(1, b.life / 3)
    const sc = grow * (b.small ? 0.8 : 1)
    const op = Math.min(1, b.life * 3) * Math.min(1, (b.max - b.life) * 2)
    const sx = b.shake > 0 ? Math.sin(b.shake * 70) * 7 : 0
    const dy = b.kind === 'notify' && b.life < 0.3 ? -40 * (1 - b.life / 0.3) : 0
    return `transform: translate(${b.x + sx}px, ${b.y + dy}px) scale(${sc}); opacity: ${op}`
  }

  const verdict = $derived(
    difficulty === 'easy' && score < brief.quiz.length
      ? '字明明都還在畫面上……但你得先把視線從念頭那邊搶回來。'
      : score < 4 ? '你明明很認真在聽，對吧？' : '記住了！但你有多累？',
  )
</script>

<div class="page">
  <div class="boss">
    <span class="emo">{brief.scenario.emoji}</span>
    <span>{brief.scenario.speaker}<b>{brief.scenario.once}</b></span>
  </div>

  <div class="talk" bind:this={area}>
    {#if phase === 'talk'}
      {#if difficulty === 'hard'}
        {#if lineVisible && lineIdx >= 0}
          {#key lineIdx}
            <p class="line" in:fade={{ duration: 120 }} out:fade={{ duration: 300 }}>{brief.lines[lineIdx]}</p>
          {/key}
        {/if}
      {:else}
        <!-- 簡單、普通共用逐字稿版面：每句固定在自己的位置，普通模式只是會慢慢變淡 -->
        <div class="transcript" class:cols={!stage.portrait}>
          {#each shown as s (s.i)}
            <p
              class="tline"
              class:latest={s.i === lineIdx}
              style:opacity={difficulty === 'normal' ? fadeOf(s) : 1}
              in:fade={{ duration: 150 }}
            >{brief.lines[s.i]}</p>
          {/each}
        </div>
      {/if}
      <span class="progress">{Math.max(0, lineIdx + 1)} / {brief.lines.length}</span>
    {/if}
  </div>
</div>

{#each bubbles as b (b.id)}
  <button
    class="bubble {b.kind}"
    class:small={b.small}
    style={bubbleStyle(b)}
    onpointerenter={(e) => onEnter(b, e)}
    onpointerdown={() => pop(b)}
  >
    {#if b.kind === 'notify'}
      <span class="app emo">📱</span><span class="ntext">{b.text}</span>
    {:else}
      💭 {b.text}
    {/if}
  </button>
{/each}

{#if phase === 'intro'}
  <div class="overlay">
    <div class="box">
      <h2>念頭插隊</h2>
      <p>有人要交代一件事，講完會考你內容。<br />可能是主管、教授，或是出門前的媽媽——每一局都不一樣。</p>
      <p class="muted">你的腦袋會一直冒出念頭。點一下可以把它趕走。</p>
      <div class="levels">
        {#each LEVELS as l}
          <button class="level" class:hard={l.id === 'hard'} onclick={() => start(l.id)}>
            <span class="lname">{l.name}</span>
            <span class="ldesc">{l.desc}</span>
            {#if best[l.id]}<span class="lbest">最佳 {best[l.id]} 題</span>{/if}
          </button>
        {/each}
      </div>
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
    myth={brief.scenario.myth}
    truth="ADHD 的大腦很難把「不相關的念頭」擋在門外——它們會自己冒出來，而且一個牽出下一個。不是不想聽，是每一句話都得跟腦中的聲音搶位置。事後被問「我剛剛不是講過了？」，是最常聽到的一句話。"
    onretry={() => start()}
  >
    <p>難度：<b>{levelName}</b></p>
    <p>你趕走了 <b>{popped}</b> 個念頭——每趕一個，就少聽一句</p>
    <p>這個難度的最佳紀錄：答對 <b>{best[difficulty]}</b> 題</p>
    <p>{verdict}</p>
    <button class="switch" onclick={() => (phase = 'intro')}>換難度</button>
  </Debrief>
{/if}

<style>
  .page { position: fixed; inset: 0; background: var(--panel2); display: grid; grid-template-rows: auto 1fr; gap: 14px; padding: 60px 16px 16px; }
  .boss { display: flex; gap: 12px; align-items: center; color: var(--muted); font-size: 17px; }
  .boss b { color: var(--text); }
  .emo { font-family: var(--emoji); font-size: 44px; }
  .talk {
    position: relative; background: #f2eee6; color: #2a2433; border-radius: 14px;
    display: grid; place-items: center; padding: 24px; overflow: hidden;
  }
  .line { grid-area: 1 / 1; font-size: 34px; font-weight: 700; text-align: center; line-height: 1.5; text-wrap: balance; }

  /* 簡單／普通：逐字稿，橫向畫面分兩欄 */
  .transcript { width: 100%; align-self: start; }
  .transcript.cols { column-count: 2; column-fill: auto; column-gap: 32px; height: calc(6 * 1.55 * 24px + 5 * 6px); }
  .tline { font-size: 24px; font-weight: 500; line-height: 1.55; margin-bottom: 6px; color: #5b5468; break-inside: avoid; }
  .transcript:not(.cols) .tline { font-size: 26px; }
  .latest { color: #2a2433; font-weight: 700; }
  .progress { position: absolute; right: 14px; bottom: 10px; font-size: 14px; color: #8a8298; font-variant-numeric: tabular-nums; }

  .bubble {
    position: fixed; left: 0; top: 0; z-index: 20; transform-origin: center;
    background: #fff; color: #2a2433; border: 0; border-radius: 999px;
    padding: 14px 24px; font: inherit; font-size: 21px; font-weight: 700; white-space: nowrap;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.4); cursor: pointer; touch-action: manipulation;
  }
  .bubble.small { font-size: 17px; padding: 10px 18px; }
  .bubble.dodge { transition: transform 0.14s ease-out; }
  .bubble.stubborn { box-shadow: 0 8px 24px rgb(0 0 0 / 0.4), inset 0 0 0 3px #d8cfe8; }
  .bubble.grow { z-index: 21; }
  .bubble.notify {
    width: 380px; border-radius: 16px; padding: 12px 16px; display: flex; gap: 10px; align-items: center;
    background: rgb(40 36 52 / 0.94); color: #f2eee6; font-size: 18px; font-weight: 500; white-space: normal; text-align: left;
    z-index: 22;
  }
  .app { font-size: 26px; }
  .ntext { line-height: 1.4; }

  .overlay { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; background: rgb(14 11 22 / 0.88); padding: 18px; }
  .box { max-width: 560px; width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 22px; display: grid; gap: 12px; line-height: 1.65; }
  h2 { font-size: 24px; font-weight: 900; }
  .muted { color: var(--muted); }
  .levels { display: grid; gap: 8px; margin-top: 4px; }
  .level {
    display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: baseline; text-align: left;
    font: inherit; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel2); color: var(--text); cursor: pointer;
  }
  .level:hover { border-color: var(--accent); }
  .lname { font-size: 18px; font-weight: 900; }
  .level.hard .lname { color: var(--red); }
  .ldesc { color: var(--muted); font-size: 15px; }
  .lbest { color: var(--gold); font-size: 14px; }
  .opts { display: grid; gap: 8px; }
  .opt { text-align: left; font: inherit; padding: 11px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel2); color: var(--text); cursor: pointer; }
  .opt:hover { border-color: var(--accent); }
  .switch {
    justify-self: start; margin-top: 6px; font: inherit; font-size: 15px; padding: 6px 14px; border-radius: 999px;
    border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer;
  }
  .switch:hover { color: var(--text); border-color: var(--accent); }
</style>
