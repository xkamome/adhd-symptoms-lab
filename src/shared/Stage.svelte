<script lang="ts">
  // 關卡的固定比例舞台：視窗比較寬就用 16:9、比較高就用 9:16，等比縮放置中，四周補邊。
  // 舞台有 transform，所以裡面 position: fixed 的元素（遮罩、結果面板）會以舞台為準，不會跑出去。
  import type { Snippet } from 'svelte'
  import { LANDSCAPE, PORTRAIT, setStage } from './stage'

  let { children }: { children: Snippet } = $props()

  let vw = $state(innerWidth)
  let vh = $state(innerHeight)

  const portrait = $derived(vh > vw)
  const size = $derived(portrait ? PORTRAIT : LANDSCAPE)
  const scale = $derived(Math.min(vw / size.w, vh / size.h))

  setStage({
    get width() { return size.w },
    get height() { return size.h },
    get scale() { return scale },
    get portrait() { return portrait },
  })
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div class="viewport">
  <div
    class="stage"
    class:portrait
    data-stage
    style="width:{size.w}px;height:{size.h}px;transform:translate(-50%, -50%) scale({scale})"
  >
    {@render children()}
  </div>
</div>

<style>
  .viewport { position: fixed; inset: 0; overflow: hidden; background: #07050c; }
  .stage {
    position: absolute; left: 50%; top: 50%; overflow: hidden;
    transform-origin: center; background: var(--bg);
  }
</style>
