<script lang="ts">
  import { MECHANICS } from './mechanics/registry'
  import { CHANGELOG } from './changelog'
  import Stage from './shared/Stage.svelte'

  let selectedId = $state<string | null>(null)
  const current = $derived(MECHANICS.find((m) => m.id === selectedId) ?? null)

  const statusLabel = { polished: '完成度較高', experimental: '測試中' } as const
</script>

{#if current}
  {@const Mechanic = current.component}
  <Stage>
    <button class="back" onclick={() => (selectedId = null)}>← 返回</button>
    <Mechanic />
  </Stage>
{:else}
  <main class="menu">
    <header>
      <div class="eyebrow">ADHD 症狀實驗室</div>
      <h1>做不好的一天</h1>
      <p>每一關的任務都簡單到誰都會——難的是你的腦袋不配合。<br />玩完你會知道，那不是懶，也不是不在乎。</p>
    </header>

    <ul class="cards">
      {#each MECHANICS as m}
        <li>
          <button class="card" onclick={() => (selectedId = m.id)}>
            <span class="icon" aria-hidden="true">{m.emoji}</span>
            <span class="body">
              <span class="card-top">
                <span class="ctitle">{m.title}</span>
                <span class="csymptom">{m.symptom}</span>
                <span class="cstatus" class:polished={m.status === 'polished'}>{statusLabel[m.status]}</span>
              </span>
              <span class="ctask">{m.task}</span>
              <span class="cblurb">{m.blurb}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <footer>更多 ADHD 症狀機制陸續加入…</footer>

    <section class="changelog">
      <h2>更新紀錄</h2>
      {#each CHANGELOG as entry}
        <div class="clog-entry">
          <div class="clog-date">{entry.date}</div>
          <ul class="clog-items">
            {#each entry.items as item}<li>{item}</li>{/each}
          </ul>
        </div>
      {/each}
    </section>
  </main>
{/if}

<style>
  .back {
    position: fixed; top: 12px; right: 14px; z-index: 60;
    padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px;
    background: rgb(14 11 22 / 0.7); color: var(--text); font: inherit; font-size: 15px;
    cursor: pointer; backdrop-filter: blur(4px);
  }

  .menu { max-width: 640px; margin: 0 auto; padding-inline: 16px; padding-block: 44px 60px; display: grid; gap: 28px; }
  header { display: grid; gap: 8px; }
  .eyebrow { font-size: 12px; letter-spacing: 0.14em; color: var(--accent); }
  h1 { font-size: clamp(30px, 7vw, 42px); font-weight: 900; line-height: 1.2; text-wrap: balance; }
  header p { color: var(--muted); font-size: 15px; line-height: 1.7; }

  .cards { list-style: none; display: grid; gap: 12px; }
  .card {
    width: 100%; text-align: left; display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;
    border: 1px solid var(--line); border-radius: 14px; background: var(--panel);
    padding: 18px; cursor: pointer; font: inherit; color: inherit;
    transition: transform 0.12s, border-color 0.2s;
  }
  .card:hover { border-color: var(--accent); transform: translateY(-2px); }
  .card:active { transform: scale(0.99); }
  .card:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .icon {
    font-family: var(--emoji); font-size: 30px; width: 54px; height: 54px; border-radius: 12px;
    display: grid; place-items: center; background: var(--panel2);
  }
  .body { display: grid; gap: 4px; min-width: 0; }
  .card-top { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .ctitle { font-size: 19px; font-weight: 900; }
  .csymptom { font-size: 12px; color: var(--accent); letter-spacing: 0.06em; }
  .cstatus { margin-left: auto; font-size: 11px; padding: 2px 9px; border-radius: 999px; background: var(--panel2); color: var(--muted); }
  .cstatus.polished { background: rgb(92 255 166 / 0.12); color: var(--green); }
  .ctask { font-size: 14px; color: var(--gold); }
  .cblurb { color: var(--muted); font-size: 13.5px; line-height: 1.65; }
  footer { text-align: center; color: var(--muted); font-size: 12px; opacity: 0.7; }

  .changelog { border-top: 1px solid var(--line); padding-top: 20px; }
  .changelog h2 { font-size: 13px; color: var(--muted); letter-spacing: 0.1em; margin-bottom: 14px; font-weight: 500; }
  .clog-entry { margin-bottom: 14px; }
  .clog-date { font-size: 12px; color: var(--gold); font-weight: 700; margin-bottom: 4px; font-variant-numeric: tabular-nums; }
  .clog-items { list-style: none; display: grid; gap: 3px; }
  .clog-items li { font-size: 12.5px; color: var(--muted); line-height: 1.55; padding-left: 14px; position: relative; }
  .clog-items li::before { content: '·'; position: absolute; left: 3px; }
</style>
