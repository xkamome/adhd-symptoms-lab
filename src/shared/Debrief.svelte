<script lang="ts">
  // 每關結束的共用結果面板：成績 + 「一般人以為／其實是」
  import type { Snippet } from 'svelte'

  let { title, myth, truth, onretry, children }: {
    title: string
    myth: string
    truth: string
    onretry: () => void
    children?: Snippet
  } = $props()
</script>

<div class="overlay">
  <div class="box">
    <h2>{title}</h2>
    <div class="stats">{@render children?.()}</div>
    <div class="myth">
      <span class="k">一般人以為</span>
      <p class="wrong">{myth}</p>
      <span class="k">其實是</span>
      <p class="right">{truth}</p>
    </div>
    <button class="primary" onclick={onretry}>再玩一次</button>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 40; display: grid; place-items: center;
    background: rgb(14 11 22 / 0.88); padding: 18px; overflow-y: auto;
  }
  .box {
    max-width: 540px; width: 100%; background: var(--panel); border: 1px solid var(--line);
    border-radius: 14px; padding: 22px; display: grid; gap: 12px;
  }
  h2 { font-size: 22px; font-weight: 900; }
  .stats { display: grid; gap: 2px; font-variant-numeric: tabular-nums; line-height: 1.6; }
  .stats :global(b) { color: var(--gold); }
  .myth { display: grid; gap: 6px; border-top: 1px solid var(--line); padding-top: 12px; line-height: 1.65; }
  .k { font-size: 14px; letter-spacing: 0.1em; color: var(--muted); }
  .wrong { color: var(--muted); text-decoration: line-through; text-decoration-color: var(--red); }
  .right { color: var(--text); }
  .primary {
    justify-self: start; font: inherit; font-weight: 700; padding: 10px 22px; border: 0; border-radius: 10px;
    background: var(--accent); color: var(--bg); cursor: pointer;
  }
</style>
