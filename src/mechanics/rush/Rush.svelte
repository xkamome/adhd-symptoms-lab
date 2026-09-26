<script lang="ts">
  // 急迫引擎（客人快到了）：同一雙手，平常又慢又飄還會突然放手；死線逼近才突然俐落。
  import { onMount } from 'svelte'
  import Debrief from '../../shared/Debrief.svelte'
  import { localPoint } from '../../shared/stage'

  const TOTAL = 45 // 一局秒數
  const URGENT_LEFT = 12 // 剩這麼多秒起算「最後衝刺」
  const MESS = ['🧦', '🥤', '📚', '🧸', '👕', '🍕', '🗞️', '🎮', '🧺', '🥡']
  const GRAB_R = 48 // 手與物品距離多近才抓得到（css px）
  const BOX = { w: 150, h: 130, m: 18 } // 右下角收納箱

  type Item = { id: number; e: string; x: number; y: number; stored: boolean }

  let phase = $state<'intro' | 'play' | 'done'>('intro')
  let items = $state<Item[]>([])
  let hand = $state({ x: 0, y: 0 }) // 顯示用（含飄移）
  let ptr = $state({ x: 0, y: 0 })
  let heldId = $state<number | null>(null)
  let t = $state(0)
  let early = $state(0)
  let late = $state(0)
  let drops = $state(0)
  let toast = $state<{ text: string; id: number } | null>(null)

  const KEY = 'rush-best'
  function loadBest(): number {
    try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 }
  }
  let best = $state(loadBest())

  let room: HTMLDivElement
  let base = { x: 0, y: 0 } // 追著指標跑的「真正的手」，飄移另外疊上去

  const u = () => Math.min(1, t / TOTAL)
  const left = $derived(Math.max(0, TOTAL - t))
  const urgent = $derived(left <= URGENT_LEFT)
  const stateText = $derived(urgent ? '⚡ 客人快到了！' : left < 25 ? '好像該動起來了……' : '身體好沉……還有很多時間吧')

  function scatter() {
    const W = room.clientWidth, H = room.clientHeight
    items = MESS.map((e, id) => {
      let x: number, y: number
      do { x = 50 + Math.random() * (W - 110); y = 110 + Math.random() * (H - 160) }
      while (x > W - BOX.w - 60 && y > H - BOX.h - 50)
      return { id, e, x, y, stored: false }
    })
    base = { x: W / 2, y: H / 2 }; ptr = { ...base }; hand = { ...base }
  }

  function start() {
    t = 0; early = 0; late = 0; drops = 0; heldId = null; toast = null
    scatter()
    phase = 'play'
  }

  function say(text: string) { toast = { text, id: Math.random() } }

  function handPos() {
    const a = 120 * Math.pow(1 - u(), 1.6)
    return {
      x: base.x + a * (Math.sin(t * 1.3) + Math.sin(t * 2.3 + 1)) / 2,
      y: base.y + a * 0.7 * (Math.sin(t * 1.7 + 2) + Math.sin(t * 0.9)) / 2,
    }
  }

  const local = (e: PointerEvent) => localPoint(e, room)

  function onDown(e: PointerEvent) {
    if (phase !== 'play') return
    ptr = local(e)
    room.setPointerCapture(e.pointerId)
    // 抓的是「手」底下的東西，不是游標底下的
    const h = handPos()
    let bestD = GRAB_R, pick: Item | null = null
    for (const it of items) {
      if (it.stored) continue
      const d = Math.hypot(it.x - h.x, it.y - h.y)
      if (d < bestD) { bestD = d; pick = it }
    }
    if (pick) heldId = pick.id
  }

  function release(dropped = false) {
    const it = items.find((i) => i.id === heldId)
    heldId = null
    if (!it || dropped) return
    const W = room.clientWidth, H = room.clientHeight
    if (it.x > W - BOX.w - BOX.m - 10 && it.y > H - BOX.h - BOX.m - 10) {
      it.stored = true
      if (TOTAL - t > URGENT_LEFT) early++; else late++
    }
  }

  function finish() {
    phase = 'done'
    heldId = null
    const total = early + late
    if (total > best) { best = total; try { localStorage.setItem(KEY, String(total)) } catch {} }
  }

  onMount(() => {
    scatter()
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (phase === 'play') step(dt)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  })

  function step(dt: number) {
    t += dt
    const k = u()
    // 平常：手又慢又飄；時間越近，反應越俐落
    const f = 1 - Math.exp(-(1.2 + 26 * Math.pow(k, 2.4)) * dt)
    base.x += (ptr.x - base.x) * f
    base.y += (ptr.y - base.y) * f
    hand = handPos()
    const held = items.find((i) => i.id === heldId)
    if (held) {
      held.x = hand.x; held.y = hand.y + 14
      // 拿著拿著，念頭一飄就鬆手了
      if (Math.random() < dt * 0.45 * Math.pow(1 - k, 2)) {
        drops++; release(true)
        say(['……欸，我剛剛在幹嘛', '手一鬆就掉了', '等等，先看一下這個'][Math.floor(Math.random() * 3)])
      }
    }
    if (left <= 0 || items.every((i) => i.stored)) finish()
  }
</script>

<div
  class="room"
  class:urgent
  bind:this={room}
  onpointermove={(e) => (ptr = local(e))}
  onpointerdown={onDown}
  onpointerup={() => release()}
  onpointercancel={() => release()}
  role="application"
  aria-label="把東西拖進收納箱"
>
  <div class="top">
    <span class="clock">{Math.ceil(left)}</span>
    <span class="state">{stateText}</span>
  </div>

  <div class="box" style="width:{BOX.w}px;height:{BOX.h}px;right:{BOX.m}px;bottom:{BOX.m}px">
    <span class="emo big">📦</span>收納箱
  </div>

  {#each items as it (it.id)}
    {#if !it.stored}
      <div class="item emo" class:held={it.id === heldId} style="left:{it.x}px;top:{it.y}px">{it.e}</div>
    {/if}
  {/each}

  {#if phase === 'play'}
    <div class="ghost" style="left:{ptr.x}px;top:{ptr.y}px"></div>
    <div class="hand emo" style="left:{hand.x}px;top:{hand.y}px">{heldId !== null ? '✊' : '✋'}</div>
  {/if}

  {#if toast}
    {#key toast.id}
      <div class="toast">{toast.text}</div>
    {/key}
  {/if}
</div>

{#if phase === 'intro'}
  <div class="overlay">
    <div class="panel">
      <h2>急迫引擎</h2>
      <p>客人 {TOTAL} 秒後到。把地上的東西拖進右下角的收納箱。</p>
      <p class="muted">你的手今天……有點不聽使喚。</p>
      <button class="primary" onclick={start}>開始</button>
    </div>
  </div>
{:else if phase === 'done'}
  <Debrief
    title="🔔 客人到了：收好 {early + late} / {MESS.length} 件"
    myth="明明做得到，只是愛拖延。"
    truth="ADHD 的大腦靠「興趣、新奇、挑戰、急迫」發動，平常的「這件事很重要」推不動它。沒有壓力時，連簡單的事都像在糖漿裡動；死線一到，突然什麼都做得到。這不是故意拖——是引擎只吃這幾種燃料。"
    onretry={start}
  >
    <p>前 {TOTAL - URGENT_LEFT} 秒：收了 <b>{early}</b> 件</p>
    <p>最後 {URGENT_LEFT} 秒：收了 <b>{late}</b> 件</p>
    <p>拿到一半掉下去：<b>{drops}</b> 次</p>
    <p>最佳紀錄：<b>{best}</b> 件</p>
    <p>同一雙手。差別只是還剩多少時間。</p>
  </Debrief>
{/if}

<style>
  .room {
    position: fixed; inset: 0; cursor: none; touch-action: none; overflow: hidden;
    background: repeating-linear-gradient(90deg, rgb(255 255 255 / 0.018) 0 60px, transparent 60px 120px), var(--panel2);
    transition: box-shadow 0.4s;
  }
  .room.urgent { box-shadow: inset 0 0 140px rgb(255 92 122 / 0.38); }
  .top { position: absolute; left: 16px; right: 110px; top: 12px; display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; pointer-events: none; }
  .clock { font-size: 34px; font-weight: 900; color: var(--gold); font-variant-numeric: tabular-nums; }
  .urgent .clock { color: var(--red); }
  .state { color: var(--muted); }
  .emo { font-family: var(--emoji); }
  .box {
    position: absolute; border-radius: 14px; border: 2px dashed var(--accent); display: grid; place-items: center;
    align-content: center; color: var(--muted); font-size: 15px; pointer-events: none;
  }
  .big { font-size: 44px; }
  .item { position: absolute; font-size: 38px; width: 56px; height: 56px; display: grid; place-items: center; margin: -28px 0 0 -28px; pointer-events: none; }
  .item.held { filter: drop-shadow(0 8px 6px rgb(0 0 0 / 0.6)); z-index: 8; }
  .hand { position: absolute; font-size: 40px; margin: -20px 0 0 -20px; pointer-events: none; z-index: 12; }
  .ghost { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; border: 1px solid rgb(255 255 255 / 0.35); pointer-events: none; z-index: 11; }
  .toast {
    position: absolute; left: 50%; top: 64px; transform: translateX(-50%); padding: 6px 14px; border-radius: 999px;
    background: rgb(0 0 0 / 0.55); font-size: 16px; white-space: nowrap; pointer-events: none;
    animation: toast 1.8s forwards;
  }
  @keyframes toast { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }

  .overlay { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; background: rgb(14 11 22 / 0.88); padding: 18px; }
  .panel { max-width: 520px; width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 22px; display: grid; gap: 12px; line-height: 1.65; }
  h2 { font-size: 22px; font-weight: 900; }
  .muted { color: var(--muted); }
  .primary { justify-self: start; font: inherit; font-weight: 700; padding: 10px 22px; border: 0; border-radius: 10px; background: var(--accent); color: var(--bg); cursor: pointer; }
</style>
