<script lang="ts">
  import { MECHANICS } from './mechanics/registry'
  import { CHANGELOG } from './changelog'

  let selectedId = $state<string | null>(null)
  const current = $derived(MECHANICS.find((m) => m.id === selectedId) ?? null)

  const statusLabel = { polished: '完成度較高', experimental: '測試中' } as const
</script>

{#if current}
  {@const Mechanic = current.component}
  <button class="back" onclick={() => (selectedId = null)}>← 返回</button>
  <Mechanic />
{:else}
  <main class="menu">
    <header>
      <h1>ADHD 症狀實驗室</h1>
      <p>把神經多樣性的內在經驗，做成可以親身體會的小機制。選一個進去玩。</p>
    </header>
    <ul>
      {#each MECHANICS as m}
        <li>
          <button class="card" onclick={() => (selectedId = m.id)}>
            <div class="card-top">
              <span class="ctitle">{m.title}</span>
              <span class="csymptom">{m.symptom}</span>
              <span class="cstatus" class:polished={m.status === 'polished'}>{statusLabel[m.status]}</span>
            </div>
            <p class="cblurb">{m.blurb}</p>
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
    position: fixed;
    top: 12px;
    right: 14px;
    z-index: 10;
    padding: 8px 14px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    background: rgba(10, 12, 18, 0.55);
    color: #e2e8f0;
    font-size: 13px;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    cursor: pointer;
    backdrop-filter: blur(4px);
  }

  .menu {
    max-width: 560px;
    margin: 0 auto;
    padding: 44px 20px 60px;
    font-family: system-ui, "Microsoft JhengHei", sans-serif;
    color: #e7ecf3;
  }
  header h1 { font-size: 26px; font-weight: 800; letter-spacing: 0.06em; }
  header p { color: #9aa6b8; margin-top: 8px; font-size: 14px; line-height: 1.6; }
  ul { list-style: none; margin: 28px 0 0; display: flex; flex-direction: column; gap: 14px; }
  .card {
    width: 100%;
    text-align: left;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
    padding: 18px 20px;
    cursor: pointer;
    font-family: inherit;
    color: inherit;
    transition: transform 0.12s, border-color 0.2s;
  }
  .card:hover { border-color: rgba(245, 158, 11, 0.6); transform: translateY(-2px); }
  .card:active { transform: scale(0.99); }
  .card-top { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .ctitle { font-size: 18px; font-weight: 700; }
  .csymptom { font-size: 12px; color: #f59e0b; letter-spacing: 0.08em; }
  .cstatus {
    margin-left: auto; font-size: 11px; padding: 2px 9px; border-radius: 999px;
    background: rgba(255, 255, 255, 0.08); color: #9aa6b8; letter-spacing: 0.04em;
  }
  .cstatus.polished { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
  .cblurb { color: #9aa6b8; font-size: 13px; line-height: 1.6; margin-top: 8px; }
  footer { margin-top: 28px; text-align: center; color: #5b6678; font-size: 12px; }

  .changelog { margin-top: 40px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px; }
  .changelog h2 { font-size: 14px; color: #7c8aa0; letter-spacing: 0.1em; margin-bottom: 14px; }
  .clog-entry { margin-bottom: 14px; }
  .clog-date { font-size: 12px; color: #f59e0b; font-weight: 700; margin-bottom: 4px; }
  .clog-items { list-style: none; display: flex; flex-direction: column; gap: 3px; }
  .clog-items li {
    font-size: 12.5px; color: #9aa6b8; line-height: 1.5; padding-left: 14px; position: relative;
  }
  .clog-items li::before { content: '·'; position: absolute; left: 3px; color: #5b6678; }
</style>
