// 可重用的「超專注隧道」對焦濾鏡。
// 用法：new FocusTunnel(img, opts) → resize() → 每幀 update(dt, pointer) + render(ctx)。
// 整張圖預設模糊；游標停住越久 → 視野半徑越縮、中心解析度越高；一移動就重置。
// 圖以 cover 縮放，溢出螢幕的部分可用 pan() 平移看到（手機直屏看橫幅畫用）。
// 全程以「裝置像素」運算：呼叫端請設 canvas.width = cssW*dpr 且 ctx 不要 setTransform。

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
  maxDwell: 0.35, // 稍微慢一點才完全清楚
  heavyBlur: 8, // 對焦時周邊只比平常稍糊
  mediumBlur: 5, // 平常的普通模糊
  maxRadiusFrac: 0.18, minRadiusFrac: 0.13, // 針孔大一點
  moveThreshold: 4, moveDecay: 0.22, peripheryBoost: 0.6,
}

export class FocusTunnel {
  private img: HTMLImageElement
  private opt: Required<Omit<FocusTunnelOptions, 'decorate'>> & Pick<FocusTunnelOptions, 'decorate'>
  private dpr = 1
  private W = 0
  private H = 0
  private layerW = 0 // 縮放後整張圖的尺寸（≥ 螢幕，溢出部分靠 pan 看）
  private layerH = 0
  private panX = 0 // ≤0，把圖往左/上挪多少（裝置像素）
  private panY = 0
  private sharp: HTMLCanvasElement | null = null
  private medium: HTMLCanvasElement | null = null
  private heavy: HTMLCanvasElement | null = null
  private lens: HTMLCanvasElement | null = null
  private dwell = 0
  private last: { x: number; y: number } | null = null
  focus: FocusState = { x: 0, y: 0, radius: 0, clarity: 0, active: false }
  revealed = false // 看答案：整張直接畫清晰層

  constructor(img: HTMLImageElement, opt: FocusTunnelOptions = {}) {
    this.img = img
    this.opt = { ...DEFAULTS, ...opt }
  }

  resize(cssW: number, cssH: number, dpr: number) {
    // resize 後保留原本的視窗位置比例（第一次置中）
    const fx = this.layerW > this.W ? this.panX / (this.W - this.layerW) : 0.5
    const fy = this.layerH > this.H ? this.panY / (this.H - this.layerH) : 0.5
    this.dpr = dpr
    this.W = Math.max(1, Math.round(cssW * dpr))
    this.H = Math.max(1, Math.round(cssH * dpr))
    const iw = this.img.naturalWidth, ih = this.img.naturalHeight
    const s = Math.max(this.W / iw, this.H / ih)
    this.layerW = Math.max(this.W, Math.round(iw * s))
    this.layerH = Math.max(this.H, Math.round(ih * s))
    this.panX = (this.W - this.layerW) * fx
    this.panY = (this.H - this.layerH) * fy
    this.sharp = this.buildLayer(0)
    this.medium = this.buildLayer(this.opt.mediumBlur * dpr)
    this.heavy = this.buildLayer(this.opt.heavyBlur * dpr)
    this.lens = document.createElement('canvas')
    this.lens.width = this.W; this.lens.height = this.H
  }

  private buildLayer(blurPx: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = this.layerW; c.height = this.layerH
    const ctx = c.getContext('2d')!
    ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none'
    ctx.drawImage(this.img, 0, 0, this.layerW, this.layerH)
    // decorate 用「層內」座標（不含 pan），render 時整層一起平移
    this.opt.decorate?.(ctx, {
      toScreen: (tx, ty) => ({ x: tx * this.layerW, y: ty * this.layerH }),
      dpr: this.dpr,
    })
    ctx.filter = 'none'
    return c
  }

  imgToScreen(tx: number, ty: number) {
    return { x: this.panX + tx * this.layerW, y: this.panY + ty * this.layerH }
  }

  /** 平移視窗（css px；正值 = 畫面內容跟著往右/下）。自動 clamp 在圖的範圍內。 */
  pan(dxCss: number, dyCss: number) {
    this.panX = Math.min(0, Math.max(this.W - this.layerW, this.panX + dxCss * this.dpr))
    this.panY = Math.min(0, Math.max(this.H - this.layerH, this.panY + dyCss * this.dpr))
  }

  /** 圖是否比螢幕寬（有左右可平移的空間） */
  get overflowX() { return this.layerW > this.W + 1 }
  /** 目前視窗位置（給位置條用）：start/size 都是 0..1 的比例 */
  get viewX() { return { start: -this.panX / this.layerW, size: this.W / this.layerW } }

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
    if (this.revealed && this.sharp) {
      // 看答案：整張清晰
      ctx.globalAlpha = 1
      ctx.drawImage(this.sharp, this.panX, this.panY)
      return
    }
    // 基準：平常的普通模糊
    ctx.globalAlpha = 1
    ctx.drawImage(this.medium, this.panX, this.panY)
    const f = this.focus
    if (f.active && f.clarity > 0.001 && this.lens && this.heavy && this.sharp) {
      // 對焦時：周邊「輕微更糊」(疊上 heavy，強度隨專注程度)
      ctx.globalAlpha = f.clarity * this.opt.peripheryBoost
      ctx.drawImage(this.heavy, this.panX, this.panY)
      ctx.globalAlpha = 1
      // 針孔焦點：以普通模糊為底，疊上清晰，柔邊遮罩
      const lx = this.lens.getContext('2d')!
      lx.globalCompositeOperation = 'source-over'
      lx.clearRect(0, 0, this.W, this.H)
      lx.globalAlpha = 1
      lx.drawImage(this.medium, this.panX, this.panY)
      lx.globalAlpha = f.clarity
      lx.drawImage(this.sharp, this.panX, this.panY)
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
