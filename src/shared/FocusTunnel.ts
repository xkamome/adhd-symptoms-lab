// 可重用的「超專注隧道」對焦濾鏡。
// 用法：new FocusTunnel(img, opts) → resize() → 每幀 update(dt, pointer) + render(ctx)。
// 整張圖預設模糊；游標停住越久 → 視野半徑越縮、中心解析度越高；一移動就重置。
// 全程以「裝置像素」運算：呼叫端請設 canvas.width = cssW*dpr 且 ctx 不要 setTransform。

export interface Cover { scale: number; offsetX: number; offsetY: number; imgW: number; imgH: number }
export interface FocusState { x: number; y: number; radius: number; clarity: number; active: boolean }
export interface DecorateApi { toScreen: (tx: number, ty: number) => { x: number; y: number }; dpr: number }

export interface FocusTunnelOptions {
  maxDwell?: number // 對焦到頂所需秒數 (越小越「馬上清楚」)
  heavyBlur?: number // 對焦時周邊額外模糊 (css px)
  mediumBlur?: number // 平常的「普通不清楚」基準 (css px)
  maxRadiusFrac?: number // 起始視野半徑 (相對 min(W,H))
  minRadiusFrac?: number // 完全對焦時的視野半徑
  moveThreshold?: number // 視為「移動」的位移 (css px)
  moveDecay?: number // 移動時清晰度衰退到 0 所需秒數 (短暫漸退)
  peripheryBoost?: number // 對焦時周邊額外模糊的強度 0..1 (越小越「輕微」)
  decorate?: (ctx: CanvasRenderingContext2D, api: DecorateApi) => void // 把疊加物烘進每層 (會一起被模糊)
}

const DEFAULTS = {
  maxDwell: 0.12, // 幾乎一停就清楚
  heavyBlur: 8, // 對焦時周邊只比平常稍糊
  mediumBlur: 5, // 平常的普通模糊
  maxRadiusFrac: 0.13, minRadiusFrac: 0.09, // 針孔感
  moveThreshold: 4, moveDecay: 0.22, peripheryBoost: 0.6,
}

export class FocusTunnel {
  private img: HTMLImageElement
  private opt: Required<Omit<FocusTunnelOptions, 'decorate'>> & Pick<FocusTunnelOptions, 'decorate'>
  private dpr = 1
  private W = 0
  private H = 0
  private sharp: HTMLCanvasElement | null = null
  private medium: HTMLCanvasElement | null = null
  private heavy: HTMLCanvasElement | null = null
  private lens: HTMLCanvasElement | null = null
  private cover: Cover = { scale: 1, offsetX: 0, offsetY: 0, imgW: 1, imgH: 1 }
  private dwell = 0
  private last: { x: number; y: number } | null = null
  focus: FocusState = { x: 0, y: 0, radius: 0, clarity: 0, active: false }

  constructor(img: HTMLImageElement, opt: FocusTunnelOptions = {}) {
    this.img = img
    this.opt = { ...DEFAULTS, ...opt }
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.dpr = dpr
    this.W = Math.max(1, Math.round(cssW * dpr))
    this.H = Math.max(1, Math.round(cssH * dpr))
    const iw = this.img.naturalWidth, ih = this.img.naturalHeight
    const s = Math.max(this.W / iw, this.H / ih)
    this.cover = { scale: s, offsetX: (this.W - iw * s) / 2, offsetY: (this.H - ih * s) / 2, imgW: iw, imgH: ih }
    this.sharp = this.buildLayer(0)
    this.medium = this.buildLayer(this.opt.mediumBlur * dpr)
    this.heavy = this.buildLayer(this.opt.heavyBlur * dpr)
    this.lens = document.createElement('canvas')
    this.lens.width = this.W; this.lens.height = this.H
  }

  private buildLayer(blurPx: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = this.W; c.height = this.H
    const ctx = c.getContext('2d')!
    ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none'
    const { scale, offsetX, offsetY } = this.cover
    ctx.drawImage(this.img, offsetX, offsetY, this.img.naturalWidth * scale, this.img.naturalHeight * scale)
    this.opt.decorate?.(ctx, { toScreen: (tx, ty) => this.imgToScreen(tx, ty), dpr: this.dpr })
    ctx.filter = 'none'
    return c
  }

  imgToScreen(tx: number, ty: number) {
    return {
      x: this.cover.offsetX + tx * this.cover.imgW * this.cover.scale,
      y: this.cover.offsetY + ty * this.cover.imgH * this.cover.scale,
    }
  }

  private ease(t: number) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t) }

  update(dt: number, pointerCss: { x: number; y: number } | null) {
    if (!pointerCss) { this.dwell = 0; this.last = null; this.focus.active = false; return }
    const p = { x: pointerCss.x * this.dpr, y: pointerCss.y * this.dpr }
    if (this.last) {
      const moved = Math.hypot(p.x - this.last.x, p.y - this.last.y)
      if (moved > this.opt.moveThreshold * this.dpr) {
        // 移動：短暫漸退而非瞬間歸零
        this.dwell = Math.max(0, this.dwell - dt * (this.opt.maxDwell / this.opt.moveDecay))
      } else {
        this.dwell = Math.min(this.opt.maxDwell, this.dwell + dt)
      }
    }
    this.last = p
    const prog = this.ease(this.dwell / this.opt.maxDwell)
    const minR = Math.min(this.W, this.H) * this.opt.minRadiusFrac
    const maxR = Math.min(this.W, this.H) * this.opt.maxRadiusFrac
    this.focus = { x: p.x, y: p.y, radius: maxR + (minR - maxR) * prog, clarity: prog, active: this.dwell > 0 }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (!this.medium) return
    ctx.clearRect(0, 0, this.W, this.H)
    // 基準：平常的普通模糊
    ctx.globalAlpha = 1
    ctx.drawImage(this.medium, 0, 0)
    const f = this.focus
    if (f.active && f.clarity > 0.001 && this.lens && this.heavy && this.sharp) {
      // 對焦時：周邊「輕微更糊」(疊上 heavy，強度隨專注程度)
      ctx.globalAlpha = f.clarity * this.opt.peripheryBoost
      ctx.drawImage(this.heavy, 0, 0)
      ctx.globalAlpha = 1
      // 針孔焦點：以普通模糊為底，疊上清晰，柔邊遮罩
      const lx = this.lens.getContext('2d')!
      lx.globalCompositeOperation = 'source-over'
      lx.clearRect(0, 0, this.W, this.H)
      lx.globalAlpha = 1
      lx.drawImage(this.medium, 0, 0)
      lx.globalAlpha = f.clarity
      lx.drawImage(this.sharp, 0, 0)
      lx.globalAlpha = 1
      lx.globalCompositeOperation = 'destination-in'
      const g = lx.createRadialGradient(f.x, f.y, f.radius * 0.5, f.x, f.y, f.radius)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      lx.fillStyle = g
      lx.fillRect(0, 0, this.W, this.H)
      lx.globalCompositeOperation = 'source-over'
      ctx.drawImage(this.lens, 0, 0)
    }
  }

  get size() { return { W: this.W, H: this.H, dpr: this.dpr } }
}
