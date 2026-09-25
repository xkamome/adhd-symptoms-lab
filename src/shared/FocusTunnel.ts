// 可重用的「超專注隧道」對焦濾鏡。
// 用法：new FocusTunnel(img, opts) → resize() → 每幀 update(dt, pointer) + render(ctx)。
// 整張圖被切成幾塊會慢慢漂移的區域，每塊隨機套上一種「看不清楚」（馬賽克／毛玻璃／萬花筒／色差／水波紋），
// 每隔幾秒各自換一種；游標停住越久 → 視野半徑越縮、中心越清晰；一移動就漸退。
// 圖以 cover 縮放，溢出螢幕的部分可用 pan() 平移看到（手機直屏看橫幅畫用）。
// 全程以「裝置像素」運算：呼叫端請設 canvas.width = cssW*dpr 且 ctx 不要 setTransform。
//
// 繪製走 WebGL（離屏 canvas，再 drawImage 回呼叫端的 2D ctx，所以疊加物照舊畫在 2D 上）；
// 沒有 WebGL 的瀏覽器退回舊的三層高斯模糊畫法。

export interface FocusState { x: number; y: number; radius: number; clarity: number; active: boolean }
export interface DecorateApi { toScreen: (tx: number, ty: number) => { x: number; y: number }; dpr: number }

export interface FocusTunnelOptions {
  maxDwell?: number // 對焦到頂所需秒數 (越小越「馬上清楚」)
  heavyBlur?: number // （退回模式）對焦時周邊額外模糊 (css px)
  mediumBlur?: number // （退回模式）平常的「普通不清楚」基準 (css px)
  maxRadiusFrac?: number // 起始視野半徑 (相對 min(W,H))
  minRadiusFrac?: number // 完全對焦時的視野半徑
  moveThreshold?: number // 視為「移動」的位移 (css px)
  moveDecay?: number // 移動時清晰度衰退到 0 所需秒數 (短暫漸退)
  peripheryBoost?: number // 對焦時周邊濾鏡加強的幅度 0..1
  regions?: number // 畫面切成幾塊濾鏡區域 (2..10)
  period?: number // 每塊區域平均多久換一種濾鏡 (秒)
  soft?: number // 區域交界的暈開寬度 (相對短邊；0 = 硬切)
  decorate?: (ctx: CanvasRenderingContext2D, api: DecorateApi) => void // 把疊加物烘進圖層 (會一起被濾鏡處理)
}

const DEFAULTS = {
  maxDwell: 0.35,
  heavyBlur: 8,
  mediumBlur: 5,
  maxRadiusFrac: 0.18, minRadiusFrac: 0.13,
  moveThreshold: 4, moveDecay: 0.22, peripheryBoost: 0.6,
  regions: 6, period: 5, soft: 0.08,
}

const VERT = `attribute vec2 a; varying vec2 v; void main(){ v = vec2(a.x*.5+.5, .5-a.y*.5); gl_Position = vec4(a,0.,1.); }`

// 螢幕 uv (0..1) → 圖層 uv：p*uScale + uOff（實作 cover 縮放與平移）
const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D tex;
uniform vec2 uScale, uOff, res, focusUv;
uniform float t, radius, clarity, active, revealed, count, period, soft, amp;

vec2 asp(){ return res / min(res.x, res.y); }
float h1(float n){ return fract(sin(n*127.1)*43758.5453); }
vec2 h2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))))*43758.5453); }
vec4 samp(vec2 p){ return texture2D(tex, clamp(p*uScale+uOff, 0.001, 0.999)); }

vec4 pixelate(vec2 p){ vec2 A = asp(); float cell = 0.03*amp; return samp((floor(p*A/cell)+.5)*cell/A); }
vec4 frosted(vec2 p){
  vec2 A = asp(); vec2 px = floor(p*res/1.5); vec4 c = vec4(0.);
  for (int i = 0; i < 5; i++){ c += samp(p + (h2(px + float(i)*17.3) - .5)*0.04*amp/A); }
  return c/5.;
}
vec4 kaleido(vec2 p, vec2 ctr){
  vec2 A = asp(); vec2 d = (p-ctr)*A;
  float r = length(d), a = atan(d.y, d.x) + t*0.12;
  float seg = 6.2831853/6.;
  a = mod(a, seg); a = min(a, seg-a);
  return samp(ctr + vec2(cos(a), sin(a))*r/A);
}
vec4 chroma(vec2 p, vec2 ctr){
  vec2 A = asp(); vec2 o = normalize((p-ctr)*A + 1e-4)*0.013*amp/A;
  vec4 c = vec4(samp(p+o).r, samp(p).g, samp(p-o).b, 1.);
  return mix(c, samp(p + vec2(0.028, 0.011)*amp/A), 0.4);
}
vec4 ripple(vec2 p){
  vec2 A = asp(); vec2 q = p*A;
  vec2 w = vec2(sin(q.y*38.+t*2.1)+sin(q.x*13.+q.y*9.+t*1.3), cos(q.x*33.+t*1.8)+cos(q.y*11.-t*1.1));
  return samp(p + w*0.007*amp/A);
}
vec4 filt(float k, vec2 p, vec2 ctr){
  if (k < .5) return pixelate(p);
  if (k < 1.5) return frosted(p);
  if (k < 2.5) return kaleido(p, ctr);
  if (k < 3.5) return chroma(p, ctr);
  return ripple(p);
}
vec2 seedPos(float i){
  return vec2(h1(i+.3), h1(i+7.1))*.8 + .1 + .09*vec2(sin(t*.31 + i*1.7), cos(t*.23 + i*2.3));
}
// 每塊區域節奏錯開，時間到就隨機換一種濾鏡，換的時候淡過去
vec4 region(float i, vec2 p){
  float ph = t/period + h1(i+3.3)*4.;
  float ep = floor(ph);
  float kNow = floor(h1(i*13.1 + ep*7.7)*5.);
  float kPrev = floor(h1(i*13.1 + (ep-1.)*7.7)*5.);
  vec2 c = seedPos(i);
  if (kNow == kPrev) return filt(kNow, p, c);
  return mix(filt(kPrev, p, c), filt(kNow, p, c), smoothstep(0., .6/period, fract(ph)));
}
void main(){
  vec2 p = v; vec2 A = asp();
  vec4 sharp = samp(p);
  if (revealed > .5){ gl_FragColor = vec4(sharp.rgb, 1.); return; }
  float d1 = 9., d2 = 9., i1 = 0., i2 = 0.;
  for (int k = 0; k < 10; k++){
    float i = float(k);
    if (i >= count) break;
    float d = length((p - seedPos(i))*A);
    if (d < d1){ d2 = d1; i2 = i1; d1 = d; i1 = i; }
    else if (d < d2){ d2 = d; i2 = i; }
  }
  vec4 col = region(i1, p);
  if (soft > .001 && d2 - d1 < soft) col = mix(region(i2, p), col, .5 + .5*smoothstep(0., soft, d2-d1));
  float dm = length((p - focusUv)*A);
  float s = (1. - smoothstep(radius*.5, radius, dm)) * clarity * active;
  gl_FragColor = vec4(mix(col.rgb, sharp.rgb, s), 1.);
}`

type GLState = {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  tex: WebGLTexture
  u: Record<string, WebGLUniformLocation | null>
}

function createGL(): GLState | null {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!gl) return null
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    gl.useProgram(prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const u: GLState['u'] = {}
    for (const n of ['tex', 'uScale', 'uOff', 'res', 'focusUv', 't', 'radius', 'clarity', 'active', 'revealed', 'count', 'period', 'soft', 'amp'])
      u[n] = gl.getUniformLocation(prog, n)
    return { canvas, gl, tex, u }
  } catch (e) {
    console.warn('FocusTunnel: WebGL 不可用，退回模糊畫法', e)
    return null
  }
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
  private glState: GLState | null
  private time = 0
  // 以下只有退回模式（沒有 WebGL）才會建
  private sharp: HTMLCanvasElement | null = null
  private medium: HTMLCanvasElement | null = null
  private heavy: HTMLCanvasElement | null = null
  private lens: HTMLCanvasElement | null = null
  private dwell = 0
  private last: { x: number; y: number } | null = null
  focus: FocusState = { x: 0, y: 0, radius: 0, clarity: 0, active: false }
  revealed = false // 看答案：整張直接清晰

  constructor(img: HTMLImageElement, opt: FocusTunnelOptions = {}) {
    this.img = img
    this.opt = { ...DEFAULTS, ...opt }
    this.glState = createGL()
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

    const g = this.glState
    if (g) {
      g.canvas.width = this.W; g.canvas.height = this.H
      g.gl.viewport(0, 0, this.W, this.H)
      // 貼圖不能超過 GPU 上限；超過就等比縮小（只影響清晰處的細節，座標不變）
      const max = g.gl.getParameter(g.gl.MAX_TEXTURE_SIZE) as number
      const k = Math.min(1, max / Math.max(this.layerW, this.layerH))
      const layer = this.buildLayer(0, k)
      g.gl.bindTexture(g.gl.TEXTURE_2D, g.tex)
      g.gl.texImage2D(g.gl.TEXTURE_2D, 0, g.gl.RGBA, g.gl.RGBA, g.gl.UNSIGNED_BYTE, layer)
      return
    }
    this.sharp = this.buildLayer(0)
    this.medium = this.buildLayer(this.opt.mediumBlur * dpr)
    this.heavy = this.buildLayer(this.opt.heavyBlur * dpr)
    this.lens = document.createElement('canvas')
    this.lens.width = this.W; this.lens.height = this.H
  }

  private buildLayer(blurPx: number, k = 1): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = Math.round(this.layerW * k); c.height = Math.round(this.layerH * k)
    const ctx = c.getContext('2d')!
    ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none'
    ctx.drawImage(this.img, 0, 0, c.width, c.height)
    // decorate 用「層內」座標（不含 pan），render 時整層一起平移
    this.opt.decorate?.(ctx, {
      toScreen: (tx, ty) => ({ x: tx * c.width, y: ty * c.height }),
      dpr: this.dpr * k,
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
    this.time += dt
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
    if (this.glState) return this.renderGL(ctx, this.glState)
    this.renderFallback(ctx)
  }

  private renderGL(ctx: CanvasRenderingContext2D, g: GLState) {
    const { gl, u } = g
    const f = this.focus
    const short = Math.min(this.W, this.H)
    gl.uniform1i(u.tex, 0)
    gl.uniform2f(u.uScale, this.W / this.layerW, this.H / this.layerH)
    gl.uniform2f(u.uOff, -this.panX / this.layerW, -this.panY / this.layerH)
    gl.uniform2f(u.res, this.W, this.H)
    gl.uniform2f(u.focusUv, f.x / this.W, f.y / this.H)
    gl.uniform1f(u.radius, f.radius / short)
    gl.uniform1f(u.clarity, f.clarity)
    gl.uniform1f(u.active, f.active ? 1 : 0)
    gl.uniform1f(u.revealed, this.revealed ? 1 : 0)
    gl.uniform1f(u.t, this.time)
    gl.uniform1f(u.count, Math.max(2, Math.min(10, this.opt.regions)))
    gl.uniform1f(u.period, this.opt.period)
    gl.uniform1f(u.soft, this.opt.soft)
    // 越專注，周邊越亂——超專注的代價
    gl.uniform1f(u.amp, 1 + (f.active ? f.clarity * this.opt.peripheryBoost : 0))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    ctx.clearRect(0, 0, this.W, this.H)
    ctx.drawImage(g.canvas, 0, 0)
  }

  private renderFallback(ctx: CanvasRenderingContext2D) {
    if (!this.medium) return
    ctx.clearRect(0, 0, this.W, this.H)
    if (this.revealed && this.sharp) {
      ctx.globalAlpha = 1
      ctx.drawImage(this.sharp, this.panX, this.panY)
      return
    }
    ctx.globalAlpha = 1
    ctx.drawImage(this.medium, this.panX, this.panY)
    const f = this.focus
    if (f.active && f.clarity > 0.001 && this.lens && this.heavy && this.sharp) {
      ctx.globalAlpha = f.clarity * this.opt.peripheryBoost
      ctx.drawImage(this.heavy, this.panX, this.panY)
      ctx.globalAlpha = 1
      const lx = this.lens.getContext('2d')!
      lx.globalCompositeOperation = 'source-over'
      lx.clearRect(0, 0, this.W, this.H)
      lx.globalAlpha = 1
      lx.drawImage(this.medium, this.panX, this.panY)
      lx.globalAlpha = f.clarity
      lx.drawImage(this.sharp, this.panX, this.panY)
      lx.globalAlpha = 1
      lx.globalCompositeOperation = 'destination-in'
      const gr = lx.createRadialGradient(f.x, f.y, f.radius * 0.5, f.x, f.y, f.radius)
      gr.addColorStop(0, 'rgba(255,255,255,1)')
      gr.addColorStop(1, 'rgba(255,255,255,0)')
      lx.fillStyle = gr
      lx.fillRect(0, 0, this.W, this.H)
      lx.globalCompositeOperation = 'source-over'
      ctx.drawImage(this.lens, 0, 0)
    }
  }

  get size() { return { W: this.W, H: this.H, dpr: this.dpr } }
}
