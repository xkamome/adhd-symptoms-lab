// 固定比例舞台：關卡一律畫在 960×540（橫）或 540×960（直）的邏輯座標上，再依視窗等比縮放。
// 舞台用 transform 縮放，所以裡面元素的 getBoundingClientRect() 是「縮放後」的螢幕座標，
// 滑鼠位置要除以縮放比例才會回到邏輯座標——一律透過這裡的 helper 換算。
import { getContext, setContext } from 'svelte'

export const LANDSCAPE = { w: 960, h: 540 } as const
export const PORTRAIT = { w: 540, h: 960 } as const

export interface StageInfo {
  readonly width: number
  readonly height: number
  readonly scale: number
  readonly portrait: boolean
}

const KEY = Symbol('stage')

export function setStage(info: StageInfo) { setContext(KEY, info) }

/** 不在舞台裡時（例如單獨預覽某一關）回傳以視窗為準、不縮放的預設值 */
export function getStage(): StageInfo {
  return getContext<StageInfo>(KEY) ?? {
    get width() { return innerWidth }, get height() { return innerHeight },
    scale: 1, portrait: innerHeight > innerWidth,
  }
}

/** 元素目前被縮放了幾倍（螢幕 px ÷ 邏輯 px） */
export function scaleOf(el: HTMLElement): number {
  return el.getBoundingClientRect().width / el.offsetWidth || 1
}

/** 指標事件在元素內的邏輯座標 */
export function localPoint(e: { clientX: number; clientY: number }, el: HTMLElement) {
  const r = el.getBoundingClientRect()
  const k = r.width / el.offsetWidth || 1
  return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }
}

/** 元素在舞台內的位置與大小（邏輯座標），給舞台內 position: fixed 的東西定位用 */
export function rectInStage(el: HTMLElement) {
  const stage = el.closest<HTMLElement>('[data-stage]')
  const r = el.getBoundingClientRect()
  if (!stage) return { left: r.left, top: r.top, width: r.width, height: r.height }
  const s = stage.getBoundingClientRect()
  const k = s.width / stage.offsetWidth || 1
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, width: r.width / k, height: r.height / k }
}
