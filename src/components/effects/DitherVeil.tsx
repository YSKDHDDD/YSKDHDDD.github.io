/*
 * 网点照片。
 *
 * 参考 reactbits 的 DitherVeil：整张照片压成一比特网点（像印在纸上的版画），
 * 指针扫过的位置「烧」出彩色，松手后颜色一格一格地织回网点。
 *
 * 和原版的差别，都是为了让它在首页当一个「图版」而不是一个 demo：
 *
 *   - **不装 ogl**。原版依赖 ogl 的 Renderer/Program/Texture/RenderTarget，这里手写
 *     同一套 WebGL2 管线（和 DecayCard 同一套路数），省掉一个 30KB 的运行时依赖。
 *   - **两个通道共用一个顶点着色器**，vUv 用 y 向上的裁剪空间约定。原版让纹理 y 向上、
 *     屏幕坐标 y 向下，中间靠两次翻转接上，读代码时非常容易搞反；这里只在片元里显式
 *     算一次 `sUv = vec2(vUv.x, 1.0 - vUv.y)`，翻转只出现这一次。
 *   - **inks 从 CSS 变量读**。单色版画的两个端点（墨色/纸色）由 CSS 按主题定义，
 *     组件读一次，切主题时用 MutationObserver 再读一次 —— 颜色决策留在样式表里，
 *     和站里其它令牌同一个地方。
 *   - **底下永远压一张真 `<img>`**。预渲染产物里 canvas 是空的；JS 没跑、显卡被禁、
 *     上下文被回收时，不能只剩一块空框。
 *   - **prefers-reduced-motion 下不建 GL**，直接是那张照片（不是降帧，是不动）。
 *   - **进视口时自动扫一遍**。没人告诉访客「这张图可以摸」，那就自己演示一次：
 *     一道光从左到右扫过，颜色被带出来又褪回去，之后交还给指针。
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import './DitherVeil.css'

type Pattern = 'bayer' | 'noise' | 'atkinson' | 'floyd' | 'lines'
type Palette = 'duotone' | 'rgb'
type Fit = 'contain' | 'cover'
type Kernel = [number, number, number][]
type Rgb = [number, number, number]

export interface DitherVeilProps {
  /** 照片地址。必须同源（或不带凭据的 CORS），否则画不出网点 */
  image: string
  alt: string
  /** contain 是整张放进画框，cover 是裁满 */
  fit?: Fit
  /** 网点组织方式：有序矩阵、蓝噪声、两种误差扩散、斜向雕刻线 */
  pattern?: Pattern
  /** 网点尺寸，CSS px */
  pixelSize?: number
  /** 每个通道的色阶，2 就是纯一比特 */
  levels?: number
  palette?: Palette
  /** 最暗的那一档 */
  ink?: string
  /** 最亮的那一档 */
  paper?: string
  contrast?: number
  brightness?: number
  /** 彩色窗口的半径，CSS px */
  revealRadius?: number
  /** 边缘多软：0 是硬切口 */
  softness?: number
  /** 颜色织回网点要几秒；0 关掉拖尾 */
  linger?: number
  /** 溶解边缘那一圈的颜色 */
  rimColor?: string
  /** 那圈边缘的厚度，0 是不显示 */
  rim?: number
  /** 一开始就是彩色，指针扫过的地方反而变网点 */
  reverse?: boolean
  /** 点一下，一圈颜色荡开 */
  clickBurst?: boolean
  /** 进视口时自动扫一遍（只扫一次，之后交给指针） */
  autoSweep?: boolean
  className?: string
  style?: CSSProperties
}

const MASK_SCALE = 0.5
const MAX_BURSTS = 4
const BURST_SECONDS = 1.2
const HOLD = 1.6
const INTRO_MS = 1100
const SWEEP_MS = 2600

const ORDERED: Record<string, number> = { bayer: 0, noise: 1, lines: 2 }

const KERNELS: Record<string, Kernel> = {
  atkinson: [
    [1, 0, 1 / 8],
    [2, 0, 1 / 8],
    [-1, 1, 1 / 8],
    [0, 1, 1 / 8],
    [1, 1, 1 / 8],
    [0, 2, 1 / 8],
  ],
  floyd: [
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16],
    [0, 1, 5 / 16],
    [1, 1, 1 / 16],
  ],
}

const VERTEX = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`

/**
 * 第一通道：把「指针扫过的痕迹」画进一张离屏纹理，每帧在上一次的结果上减去一点，
 * 减到 0 就是织回网点了。不是画圆，是把上一段的线段做距离场 —— 慢速拖动才不会断成珠链。
 */
const MASK_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D tPrev;
uniform vec2 uSize;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform float uRadius;
uniform float uSoftness;
uniform float uStrength;
uniform float uFade;
uniform float uHold;

in vec2 vUv;
out vec4 fragColor;

float strokeDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return length(p - a - ab * h);
}

void main() {
  vec2 sUv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 p = sUv * uSize;
  float trail = max(texture(tPrev, vUv).r - uFade, 0.0);
  float band = max(uRadius * uSoftness, 1.0) * uHold;
  float d = strokeDistance(p, uFrom, uTo);
  trail = max(trail, clamp((uRadius - d) / band, 0.0, 1.0) * uStrength);
  fragColor = vec4(trail, 0.0, 0.0, 1.0);
}`

/**
 * 第二通道：网点 + 彩色照片，用遮罩在两者之间切换。
 *
 * 网点是在「格」上算的：整张画布切成 cell 大小的格子，每格取中心一次颜色，
 * 再用阈值（有序矩阵 / 蓝噪声 / 雕刻线）决定这格取墨还是取纸。误差扩散那两种
 * 走的是另一条路 —— CPU 先把整张图抖完传到 tDiffused，这里直接取格子。
 */
const VIEW_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D tImage;
uniform sampler2D tMask;
uniform sampler2D tNoise;
uniform sampler2D tDiffused;
uniform vec2 uResolution;
uniform vec2 uCover;
uniform float uLod;
uniform float uCell;
uniform int uPattern;
uniform int uPalette;
uniform float uLevels;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec3 uRimColor;
uniform float uRim;
uniform float uContrast;
uniform float uBrightness;
uniform float uReverse;
uniform float uIntro;
uniform float uHold;
uniform vec3 uMatte;
uniform float uKey;
uniform vec2 uSize;
uniform vec4 uBursts[4];
uniform float uBurstWidth;

in vec2 vUv;
out vec4 fragColor;

float bayer(vec2 cell) {
  ivec2 p = ivec2(mod(cell, 8.0));
  int v = p.x ^ p.y;
  int m = ((v & 1) << 5) | ((p.y & 1) << 4) | ((v & 2) << 2) | ((p.y & 2) << 1) | ((v & 4) >> 1) | ((p.y & 4) >> 2);
  return (float(m) + 0.5) / 64.0;
}

float blueNoise(vec2 cell) {
  return (texelFetch(tNoise, ivec2(mod(cell, 64.0)), 0).r * 255.0 + 0.5) / 256.0;
}

float engraving(vec2 cell) {
  float period = 6.0;
  float f = (mod(cell.x + cell.y, period) + 0.5) / period;
  return clamp(abs(f * 2.0 - 1.0) + (bayer(cell) - 0.5) * (2.0 / period), 0.0, 1.0);
}

vec2 imageUv(vec2 uv) {
  return (uv - 0.5) * uCover + 0.5;
}

float within(vec2 p) {
  vec2 s = step(vec2(0.0), p) * step(p, vec2(1.0));
  return s.x * s.y;
}

vec3 grade(vec3 c) {
  return pow(clamp((c - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0), vec3(1.6));
}

float shockwave(vec2 p) {
  float value = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 burst = uBursts[i];
    if (burst.w <= 0.0) continue;
    float offset = distance(p, burst.xy) - burst.z;
    float edge = offset > 0.0 ? offset / (uBurstWidth * 0.35) : -offset / uBurstWidth;
    value = max(value, clamp(1.0 - edge, 0.0, 1.0) * burst.w);
  }
  return value;
}

vec3 toned(vec3 c) {
  return uPalette == 1 ? grade(c) : grade(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))));
}

vec3 quantize(vec3 v, float t) {
  float steps = max(uLevels - 1.0, 1.0);
  vec3 s = v * steps;
  vec3 base = floor(s);
  return min(base + step(vec3(t), s - base), vec3(steps)) / steps;
}

void main() {
  vec2 sUv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 px = sUv * uResolution;
  vec2 cell = floor(px / uCell);
  vec2 center = (cell + 0.5) * uCell;
  vec2 cellUv = center / uResolution;

  vec2 sampleUv = imageUv(cellUv);
  float framed = within(sampleUv);
  vec3 level;
  if (uPattern == 3) {
    level = texelFetch(tDiffused, ivec2(cell), 0).rgb;
  } else {
    vec3 c = mix(uMatte, textureLod(tImage, sampleUv, uLod).rgb, framed);
    float t = uPattern == 1 ? blueNoise(cell) : (uPattern == 2 ? engraving(cell) : bayer(cell));
    level = quantize(toned(c), t);
  }

  vec3 color = mix(uInk, mix(uInk, uPaper, level), max(framed, uKey));
  vec3 backdrop = mix(uInk, uPaper, toned(uMatte));
  vec2 photoUv = imageUv(sUv);
  vec3 raw = texture(tImage, photoUv).rgb;
  float plain = uKey * (1.0 - smoothstep(0.05, 0.22, distance(raw, uMatte)));
  vec3 photo = mix(mix(uInk, backdrop, uKey), mix(raw, backdrop, plain), within(photoUv));

  vec2 point = cellUv * uSize;
  float mask = max(clamp(texture(tMask, vec2(cellUv.x, 1.0 - cellUv.y)).r * uHold, 0.0, 1.0), shockwave(point));
  float shown = mix(mask, 1.0 - mask, uReverse);
  float order = bayer(cell.yx);
  float low = order * (1.0 - uRim);
  color = mix(color, uRimColor, step(low, shown) * step(0.001, uRim));
  color = mix(color, photo, step(low + uRim, shown));

  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  float spread = length((cellUv - 0.5) * aspect) / length(aspect * 0.5);
  float appear = step(spread * 0.72 + bayer(cell + vec2(3.0, 5.0)) * 0.28, uIntro * 1.001);
  fragColor = vec4(mix(uInk, color, appear), 1.0);
}`

const hexToRgb = (hex: string): Rgb => {
  let h = String(hex || '').replace('#', '').trim()
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const n = Number.parseInt(h.slice(0, 6), 16)
  return Number.isNaN(n) ? [0, 0, 0] : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** cover 是把画面裁满：宽高比不一致时，把 uv 往外扩，而不是把图压缩 */
const fitScale = (w: number, h: number, iw: number, ih: number, contain: boolean): [number, number] => {
  const ratio = w / h / (iw / ih)
  if (contain) return ratio > 1 ? [ratio, 1] : [1, 1 / ratio]
  return ratio > 1 ? [1, 1 / ratio] : [ratio, 1]
}

/** 自动扫一遍的路径：横向匀速推进，纵向一个来回的余弦 */
const sweepAt = (k: number, w: number, h: number): [number, number] => [
  w * (-0.08 + 1.16 * k),
  h * (0.52 + 0.2 * Math.sin(k * Math.PI * 1.6 - 0.4)),
]

/**
 * 量一下照片四条边的平均色。
 * 纯色背景（比如抠图后的白底）在网点里会变成一片死墨，所以要把它当成「画框的纸」，
 * 让画框之外的颜色接得上。照片本身边缘颜色杂的话，这套判断自动失效（plain=false）。
 */
const measureEdge = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
): { matte: Rgb; plain: boolean } => {
  const size = 32
  context.canvas.width = size
  context.canvas.height = size
  context.drawImage(image, 0, 0, size, size)
  const data = context.getImageData(0, 0, size, size).data
  const sum = [0, 0, 0]
  const squares = [0, 0, 0]
  let count = 0
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x > 0 && y > 0 && x < size - 1 && y < size - 1) continue
      for (let c = 0; c < 3; c += 1) {
        const v = data[(y * size + x) * 4 + c] / 255
        sum[c] += v
        squares[c] += v * v
      }
      count += 1
    }
  }
  const matte: Rgb = [sum[0] / count, sum[1] / count, sum[2] / count]
  const spread =
    matte.reduce((total, mean, c) => total + Math.sqrt(Math.max(0, squares[c] / count - mean * mean)), 0) / 3
  return { matte, plain: spread < 0.06 }
}

let blueNoise: Uint8Array | null = null

/**
 * 蓝噪声查找表：void-and-cluster。只在 pattern='noise' 时才算，几百毫秒，
 * 所以缓存起来 —— 这个函数的输出和参数无关。
 */
const getBlueNoise = (): Uint8Array => {
  if (blueNoise) return blueNoise
  const size = 64
  const n = size * size
  const wrap = size - 1
  const taps: number[] = []
  for (let dy = -6; dy <= 6; dy += 1) {
    for (let dx = -6; dx <= 6; dx += 1) taps.push(dx, dy, Math.exp(-(dx * dx + dy * dy) / 4.5))
  }
  const energy = new Float32Array(n)
  const on = new Uint8Array(n)
  const splat = (i: number, sign: number) => {
    const x = i % size
    const y = (i - x) / size
    for (let k = 0; k < taps.length; k += 3) {
      energy[((y + taps[k + 1]) & wrap) * size + ((x + taps[k]) & wrap)] += sign * taps[k + 2]
    }
  }
  const find = (state: number, highest: boolean) => {
    let best = 0
    let value = highest ? -Infinity : Infinity
    for (let i = 0; i < n; i += 1) {
      if (on[i] !== state) continue
      if (highest ? energy[i] > value : energy[i] < value) {
        value = energy[i]
        best = i
      }
    }
    return best
  }
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const initial = Math.round(n * 0.1)
  for (let placed = 0; placed < initial; ) {
    const i = Math.floor(random() * n)
    if (on[i]) continue
    on[i] = 1
    splat(i, 1)
    placed += 1
  }
  for (let guard = 0; guard < n; guard += 1) {
    const cluster = find(1, true)
    on[cluster] = 0
    splat(cluster, -1)
    const gap = find(0, false)
    on[gap] = 1
    splat(gap, 1)
    if (gap === cluster) break
  }
  const seedOn = on.slice()
  const seedEnergy = energy.slice()
  const rank = new Uint16Array(n)
  for (let r = initial - 1; r >= 0; r -= 1) {
    const cluster = find(1, true)
    on[cluster] = 0
    splat(cluster, -1)
    rank[cluster] = r
  }
  on.set(seedOn)
  energy.set(seedEnergy)
  for (let r = initial; r < n; r += 1) {
    const gap = find(0, false)
    on[gap] = 1
    splat(gap, 1)
    rank[gap] = r
  }
  const data = new Uint8Array(n * 4)
  for (let i = 0; i < n; i += 1) {
    const v = Math.floor((rank[i] / n) * 256)
    data[i * 4] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  blueNoise = data
  return data
}

/**
 * 误差扩散：把这一格量化时产生的误差按核分给邻居。
 * 逐行来回扫（蛇形），否则误差总朝一个方向偏，图上会出现斜条纹。
 * 这是纯 CPU 的，一次参数只算一遍，结果传成纹理给着色器取格子。
 */
const diffuse = (
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  kernel: Kernel,
  levels: number,
  rgb: boolean,
  grade: (v: number) => number,
): Uint8Array => {
  const channels = rgb ? 3 : 1
  const values = new Float32Array(cols * rows * channels)
  for (let i = 0; i < cols * rows; i += 1) {
    const r = pixels[i * 4] / 255
    const g = pixels[i * 4 + 1] / 255
    const b = pixels[i * 4 + 2] / 255
    if (rgb) {
      values[i * 3] = grade(r)
      values[i * 3 + 1] = grade(g)
      values[i * 3 + 2] = grade(b)
    } else {
      values[i] = grade(0.2126 * r + 0.7152 * g + 0.0722 * b)
    }
  }
  const steps = levels - 1
  const out = new Uint8Array(cols * rows * 4)
  for (let y = 0; y < rows; y += 1) {
    const dir = y & 1 ? -1 : 1
    for (let i = 0; i < cols; i += 1) {
      const x = dir > 0 ? i : cols - 1 - i
      const p = y * cols + x
      for (let c = 0; c < channels; c += 1) {
        const old = values[p * channels + c]
        const q = Math.min(steps, Math.max(0, Math.round(old * steps))) / steps
        const err = old - q
        const byte = Math.round(q * 255)
        if (rgb) out[p * 4 + c] = byte
        else out[p * 4] = out[p * 4 + 1] = out[p * 4 + 2] = byte
        for (let k = 0; k < kernel.length; k += 1) {
          const nx = x + kernel[k][0] * dir
          const ny = y + kernel[k][1]
          if (nx < 0 || nx >= cols || ny >= rows) continue
          values[(ny * cols + nx) * channels + c] += err * kernel[k][2]
        }
      }
      out[p * 4 + 3] = 255
    }
  }
  return out
}

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  // 编译失败必须删掉，否则调试时看不到真实原因
  gl.deleteShader(shader)
  return null
}

export default function DitherVeil({
  image,
  alt,
  fit = 'cover',
  pattern = 'floyd',
  pixelSize = 2,
  levels = 2,
  palette = 'duotone',
  ink = '#0a0d15',
  paper = '#cfd6e4',
  contrast = 1.15,
  brightness = 0,
  revealRadius = 220,
  softness = 0.6,
  linger = 1,
  rimColor = '#3ea6ff',
  rim = 0,
  reverse = false,
  clickBurst = true,
  autoSweep = true,
  className,
  style,
}: DitherVeilProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)
  const reduced = usePrefersReducedMotion()

  /** 参数归一化后挂在 ref 上给动画循环读；渲染期写 ref 在并发模式下不可靠 */
  const settings = {
    fit,
    pattern,
    pixelSize: Math.max(1, pixelSize),
    levels: Math.max(2, Math.round(levels)),
    palette,
    ink,
    paper,
    contrast,
    brightness,
    revealRadius: Math.max(1, revealRadius),
    softness: Math.max(0, softness),
    linger: Math.max(0, linger),
    rimColor,
    rim: Math.min(Math.max(rim, 0), 0.95),
    reverse,
    clickBurst,
    autoSweep,
  }
  const settingsRef = useRef(settings)

  // 写在 layout 阶段而不是渲染阶段：并发模式下被丢弃的那次渲染也会执行渲染期副作用
  useLayoutEffect(() => {
    settingsRef.current = settings
  })

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return undefined
    // 不建 GL：这张图就是一张照片，不动，也不网点化
    if (reduced) return undefined

    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false })
    if (!gl) {
      setFallback(true)
      return undefined
    }

    /* ---------------- 着色器与几何 ---------------- */

    const build = (fragment: string) => {
      const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
      const fs = compile(gl, gl.FRAGMENT_SHADER, fragment)
      if (!vs || !fs) {
        if (vs) gl.deleteShader(vs)
        if (fs) gl.deleteShader(fs)
        return null
      }
      const program = gl.createProgram()
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.bindAttribLocation(program, 0, 'position')
      gl.linkProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program)
        return null
      }
      return program
    }

    const maskProgram = build(MASK_FRAGMENT)
    const viewProgram = build(VIEW_FRAGMENT)
    if (!maskProgram || !viewProgram) {
      setFallback(true)
      return undefined
    }

    // 一个盖住整个裁剪空间的三角形：比两个三角形少一条接缝
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const uniform = (program: WebGLProgram, names: string[]) => {
      const out: Record<string, WebGLUniformLocation | null> = {}
      for (const name of names) out[name] = gl.getUniformLocation(program, name)
      return out
    }

    const maskU = uniform(maskProgram, [
      'tPrev',
      'uSize',
      'uFrom',
      'uTo',
      'uRadius',
      'uSoftness',
      'uStrength',
      'uFade',
      'uHold',
    ])
    const viewU = uniform(viewProgram, [
      'tImage',
      'tMask',
      'tNoise',
      'tDiffused',
      'uResolution',
      'uCover',
      'uLod',
      'uCell',
      'uPattern',
      'uPalette',
      'uLevels',
      'uInk',
      'uPaper',
      'uRimColor',
      'uRim',
      'uContrast',
      'uBrightness',
      'uReverse',
      'uIntro',
      'uHold',
      'uMatte',
      'uKey',
      'uSize',
      'uBursts[0]',
      'uBurstWidth',
    ])

    /* ---------------- 纹理与离屏帧缓冲 ---------------- */

    const makeTexture = (filter: number) => {
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      // 先挂一个 1×1 的空像素：采样不能是「没有纹理」，uReady 之类的判断会失效
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
      return texture
    }

    const imageTexture = makeTexture(gl.LINEAR_MIPMAP_LINEAR)
    const noiseTexture = makeTexture(gl.NEAREST)
    const diffusedTexture = makeTexture(gl.NEAREST)

    /*
     * 遮罩要「每帧减一点再写回去」，8 位纹理每帧减 1/255 会卡在 0 附近抖动，
     * 所以优先用半浮点；拿不到 EXT_color_buffer_float 就退回 8 位，并给一个最小衰减量。
     */
    const floatMask = !!gl.getExtension('EXT_color_buffer_float')
    const createMask = (w: number, h: number) => {
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        floatMask ? gl.RGBA16F : gl.RGBA,
        w,
        h,
        0,
        gl.RGBA,
        floatMask ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      const framebuffer = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      return { texture, framebuffer, width: w, height: h }
    }
    const destroyMask = (target: { texture: WebGLTexture | null; framebuffer: WebGLFramebuffer | null }) => {
      gl.deleteFramebuffer(target.framebuffer)
      gl.deleteTexture(target.texture)
    }

    let masks = [createMask(2, 2), createMask(2, 2)]

    /* ---------------- 运行时状态 ---------------- */

    const sampler = document.createElement('canvas')
    const samplerContext = sampler.getContext('2d', { willReadFrequently: true })

    let loaded: HTMLImageElement | null = null
    let introStart = 0
    let diffusedKey = ''
    let diffusionBlocked = false
    let width = 1
    let height = 1
    let visible = false
    let seen = false
    let sweepStart = 0
    let sweeping = false
    let raf = 0
    let last = performance.now()
    let trailUntil = 0
    let presence = 0
    let alive = true
    const pointer = { x: 0, y: 0, inside: false, fresh: true, placed: false }
    const brush = { x: 0, y: 0, px: 0, py: 0 }
    const bursts: { x: number; y: number; start: number }[] = []
    const burstData = new Float32Array(MAX_BURSTS * 4)
    // 初值全是零，紧接着 readColors() 会从 CSS 变量里读真实颜色
    let colors: { ink: Rgb; paper: Rgb; rim: Rgb } = { ink: [0, 0, 0], paper: [1, 1, 1], rim: [0, 0, 0] }

    /** 墨色/纸色/边缘色住在 CSS 变量里，切主题时重读一次；props 只作为变量缺失时的兜底 */
    const readColors = () => {
      const style = getComputedStyle(root)
      const s = settingsRef.current
      const pick = (name: string, fallbackValue: string) => {
        const value = style.getPropertyValue(name).trim()
        return hexToRgb(value || fallbackValue)
      }
      colors = {
        ink: pick('--dither-ink', s.ink),
        paper: pick('--dither-paper', s.paper),
        rim: pick('--dither-rim', s.rimColor),
      }
    }
    readColors()
    const themeObserver = new MutationObserver(() => {
      readColors()
      wake()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    /* ---------------- 布局与误差扩散 ---------------- */

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, root.clientWidth)
      height = Math.max(1, root.clientHeight)
      const w = Math.max(1, Math.round(width * dpr))
      const h = Math.max(1, Math.round(height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const mw = Math.max(2, Math.round(width * MASK_SCALE))
      const mh = Math.max(2, Math.round(height * MASK_SCALE))
      if (mw !== masks[0].width || mh !== masks[0].height) {
        masks.forEach(destroyMask)
        masks = [createMask(mw, mh), createMask(mw, mh)]
      }
      if (!pointer.placed) {
        pointer.x = width / 2
        pointer.y = height / 2
      }
    }

    const updateDiffusion = (cell: number, cover: [number, number]) => {
      if (!loaded || !samplerContext) return
      const cols = Math.ceil(canvas.width / cell)
      const rows = Math.ceil(canvas.height / cell)
      const s = settingsRef.current
      const signature = [
        s.pattern,
        s.levels,
        s.palette,
        s.contrast,
        s.brightness,
        s.fit,
        cols,
        rows,
        canvas.width,
        canvas.height,
      ].join('|')
      if (signature === diffusedKey) return
      diffusedKey = signature

      const [cx, cy] = cover
      const iw = loaded.naturalWidth
      const ih = loaded.naturalHeight
      sampler.width = cols
      sampler.height = rows
      samplerContext.imageSmoothingEnabled = true
      samplerContext.imageSmoothingQuality = 'high'
      const [mr, mg, mb] = matte
      samplerContext.fillStyle = `rgb(${mr * 255}, ${mg * 255}, ${mb * 255})`
      samplerContext.fillRect(0, 0, cols, rows)
      const sx = (0.5 - 0.5 * cx) * iw
      const sy = (0.5 - 0.5 * cy) * ih
      const sw = ((cols * cell) / canvas.width) * cx * iw
      const sh = ((rows * cell) / canvas.height) * cy * ih
      const x0 = Math.max(sx, 0)
      const y0 = Math.max(sy, 0)
      const x1 = Math.min(sx + sw, iw)
      const y1 = Math.min(sy + sh, ih)
      if (x1 > x0 && y1 > y0) {
        samplerContext.drawImage(
          loaded,
          x0,
          y0,
          x1 - x0,
          y1 - y0,
          ((x0 - sx) / sw) * cols,
          ((y0 - sy) / sh) * rows,
          ((x1 - x0) / sw) * cols,
          ((y1 - y0) / sh) * rows,
        )
      }
      const gradeValue = (v: number) =>
        Math.pow(Math.min(1, Math.max(0, (v - 0.5) * s.contrast + 0.5 + s.brightness)), 1.6)
      const pixels = samplerContext.getImageData(0, 0, cols, rows).data
      gl.bindTexture(gl.TEXTURE_2D, diffusedTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        cols,
        rows,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        diffuse(pixels, cols, rows, KERNELS[s.pattern], s.levels, s.palette === 'rgb', gradeValue),
      )
    }

    /* ---------------- 每帧 ---------------- */

    let matte: Rgb = [0, 0, 0]
    let key = 0
    let noiseReady = false

    const draw = () => {
      const s = settingsRef.current
      const w = canvas.width
      const h = canvas.height
      if (!w || !h) return
      const cover: [number, number] = loaded
        ? fitScale(w, h, loaded.naturalWidth, loaded.naturalHeight, s.fit === 'contain')
        : [1, 1]
      const cell = Math.max(1, Math.round(s.pixelSize * (w / Math.max(1, width))))

      /* 第一通道：把这一帧的笔迹叠到上一帧的痕迹上 */
      gl.bindFramebuffer(gl.FRAMEBUFFER, masks[1].framebuffer)
      gl.viewport(0, 0, masks[1].width, masks[1].height)
      gl.useProgram(maskProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, masks[0].texture)
      gl.uniform1i(maskU.tPrev, 0)
      gl.uniform2f(maskU.uSize, width, height)
      gl.uniform2f(maskU.uFrom, brush.px, brush.py)
      gl.uniform2f(maskU.uTo, brush.x, brush.y)
      gl.uniform1f(maskU.uRadius, s.revealRadius * (0.45 + 0.55 * presence))
      gl.uniform1f(maskU.uSoftness, s.softness)
      gl.uniform1f(maskU.uStrength, presence)
      gl.uniform1f(maskU.uFade, fadePerFrame)
      gl.uniform1f(maskU.uHold, HOLD)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      masks.reverse()

      /* 第二通道：把它们画到屏幕上 */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, w, h)
      gl.clearColor(colors.ink[0], colors.ink[1], colors.ink[2], 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(viewProgram)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, imageTexture)
      gl.uniform1i(viewU.tImage, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, masks[0].texture)
      gl.uniform1i(viewU.tMask, 1)
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, noiseTexture)
      gl.uniform1i(viewU.tNoise, 2)
      gl.activeTexture(gl.TEXTURE3)
      gl.bindTexture(gl.TEXTURE_2D, diffusedTexture)
      gl.uniform1i(viewU.tDiffused, 3)

      let patternIndex = ORDERED[s.pattern] ?? 0
      if (KERNELS[s.pattern] && loaded && !diffusionBlocked) {
        try {
          updateDiffusion(cell, cover)
          patternIndex = 3
        } catch {
          // 读像素被拒（画布被污染）之类：退回有序矩阵，不要让整块黑掉
          diffusionBlocked = true
        }
      }
      if (patternIndex === 1 && !noiseReady) {
        noiseReady = true
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, noiseTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, getBlueNoise())
      }

      const texelsPerPixel = loaded ? (cover[0] * loaded.naturalWidth) / w : 1
      gl.uniform2f(viewU.uResolution, w, h)
      gl.uniform2f(viewU.uCover, cover[0], cover[1])
      gl.uniform1f(viewU.uLod, Math.log2(Math.max(cell * texelsPerPixel, 1)))
      gl.uniform1f(viewU.uCell, cell)
      gl.uniform1i(viewU.uPattern, patternIndex)
      gl.uniform1i(viewU.uPalette, s.palette === 'rgb' ? 1 : 0)
      gl.uniform1f(viewU.uLevels, s.levels)
      gl.uniform3f(viewU.uInk, colors.ink[0], colors.ink[1], colors.ink[2])
      gl.uniform3f(viewU.uPaper, colors.paper[0], colors.paper[1], colors.paper[2])
      gl.uniform3f(viewU.uRimColor, colors.rim[0], colors.rim[1], colors.rim[2])
      gl.uniform1f(viewU.uRim, s.rim)
      gl.uniform1f(viewU.uContrast, s.contrast)
      gl.uniform1f(viewU.uBrightness, s.brightness)
      gl.uniform1f(viewU.uReverse, s.reverse ? 1 : 0)
      gl.uniform1f(viewU.uIntro, introValue)
      gl.uniform1f(viewU.uHold, HOLD)
      gl.uniform3f(viewU.uMatte, matte[0], matte[1], matte[2])
      gl.uniform1f(viewU.uKey, key)
      gl.uniform2f(viewU.uSize, width, height)
      gl.uniform4fv(viewU['uBursts[0]'], burstData)
      gl.uniform1f(viewU.uBurstWidth, Math.max(60, s.revealRadius * 0.9))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    let fadePerFrame = 1
    let introValue = 0

    const frame = (now: number) => {
      raf = 0
      if (!alive) return
      const s = settingsRef.current
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now

      /*
       * 自动扫一遍：只在第一次进视口、且真的没人碰过的时候跑。
       * 指针一进来就立刻让位 —— 访客自己伸手了，演示就该停。
       */
      let auto: [number, number] | null = null
      if (sweeping) {
        const k = Math.min(1, (now - sweepStart) / SWEEP_MS)
        auto = sweepAt(k, width, height)
        if (k >= 1) sweeping = false
      }
      const active = pointer.inside || auto !== null

      let targetX = auto ? auto[0] : pointer.x
      let targetY = auto ? auto[1] : pointer.y
      if (pointer.inside) {
        targetX = pointer.x
        targetY = pointer.y
      }

      presence += ((active ? 1 : 0) - presence) * (1 - Math.exp(-dt / 0.16))

      if (pointer.fresh) {
        brush.x = brush.px = targetX
        brush.y = brush.py = targetY
        pointer.fresh = false
      } else {
        const follow = 1 - Math.exp(-dt / 0.035)
        brush.x += (targetX - brush.x) * follow
        brush.y += (targetY - brush.y) * follow
      }

      burstData.fill(0)
      for (let i = bursts.length - 1; i >= 0; i -= 1) {
        if ((now - bursts[i].start) / 1000 >= BURST_SECONDS) bursts.splice(i, 1)
      }
      bursts.forEach((b, i) => {
        const k = Math.max(0, (now - b.start) / 1000 / BURST_SECONDS)
        const reach = Math.hypot(Math.max(b.x, width - b.x), Math.max(b.y, height - b.y)) + Math.max(60, s.revealRadius * 0.9)
        burstData[i * 4] = b.x
        burstData[i * 4 + 1] = b.y
        burstData[i * 4 + 2] = reach * Math.sin((k * Math.PI) / 2)
        burstData[i * 4 + 3] = 1 - k * k * k
      })

      if (presence > 0.002) trailUntil = now + s.linger * 1000 + 150

      // 8 位遮罩每帧最多减 1.5/255，否则会停在 1/255 不动，留下一道永远褪不掉的痕
      fadePerFrame = Math.max(s.linger > 0 ? dt / s.linger : 1, floatMask ? 0 : 1.5 / 255)
      introValue = loaded ? 1 - Math.pow(1 - Math.min(1, (now - introStart) / INTRO_MS), 2) : 0

      draw()

      const intro = loaded ? Math.min(1, (now - introStart) / INTRO_MS) : 0
      const busy =
        pointer.inside ||
        sweeping ||
        presence > 0.002 ||
        bursts.length > 0 ||
        now < trailUntil ||
        (!!loaded && intro < 1)
      if (busy && visible) raf = requestAnimationFrame(frame)
    }

    const wake = () => {
      if (raf || !alive || !visible) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }

    /* ---------------- 图片 ---------------- */

    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (!alive) return
      loaded = img
      try {
        if (samplerContext) {
          const edge = measureEdge(samplerContext, img)
          matte = edge.matte
          key = edge.plain ? 1 : 0
        }
      } catch {
        // 量不出来就当作「不是纯色边」，用 ink 铺满画框
      }
      gl.bindTexture(gl.TEXTURE_2D, imageTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.generateMipmap(gl.TEXTURE_2D)
      introStart = performance.now()
      // 先画一帧再收掉底下的静态图，反过来会闪一帧空框
      draw()
      setReady(true)
      setFallback(false)
      if (settingsRef.current.autoSweep && !seen) {
        seen = true
        sweeping = true
        sweepStart = performance.now() + 420
      }
      wake()
    }
    img.onerror = () => {
      if (alive) setFallback(true)
    }
    img.src = image

    /* ---------------- 事件 ---------------- */

    const locate = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
      pointer.placed = true
    }
    const onMove = (event: PointerEvent) => {
      locate(event)
      if (!pointer.inside) {
        pointer.inside = true
        pointer.fresh = true
      }
      // 人手已经在图上，自动演示就该让开
      sweeping = false
      wake()
    }
    const onLeave = () => {
      pointer.inside = false
      wake()
    }
    const onDown = (event: PointerEvent) => {
      onMove(event)
      if (!settingsRef.current.clickBurst || (event.pointerType === 'mouse' && event.button !== 0)) return
      bursts.push({ x: pointer.x, y: pointer.y, start: performance.now() })
      if (bursts.length > MAX_BURSTS) bursts.shift()
    }
    // 上下文丢失（切显卡、显存吃紧）时退回静态照片，而不是留一块黑
    const onLost = (event: Event) => {
      event.preventDefault()
      setFallback(true)
      setReady(false)
    }

    root.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerenter', onMove, { passive: true })
    root.addEventListener('pointerdown', onDown, { passive: true })
    root.addEventListener('pointerleave', onLeave, { passive: true })
    root.addEventListener('pointercancel', onLeave, { passive: true })
    canvas.addEventListener('webglcontextlost', onLost)

    const resizeObserver = new ResizeObserver(() => {
      layout()
      draw()
      wake()
    })
    resizeObserver.observe(root)

    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
      if (visible) wake()
    })
    intersection.observe(root)

    // 标签页切到后台就别再画了：这时候的 rAF 本来也会被节流，白占 CPU
    const onVisibility = () => {
      if (!document.hidden) wake()
    }
    document.addEventListener('visibilitychange', onVisibility)

    layout()

    /*
     * 先画一帧再等 rAF。
     * 画布是 alpha:false 的，没画过就是一块不透明的黑 —— 而这张图在首屏之外，
     * IntersectionObserver 判定「不可见」时根本不会启动 rAF，于是那块黑会一直压着
     * 底下的静态照片。这里按初始状态（整幅墨色）画一次，之后才交给动画循环。
     */
    draw()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersection.disconnect()
      themeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      img.onload = null
      img.onerror = null
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerenter', onMove)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointercancel', onLeave)
      canvas.removeEventListener('webglcontextlost', onLost)
      masks.forEach(destroyMask)
      gl.deleteTexture(imageTexture)
      gl.deleteTexture(noiseTexture)
      gl.deleteTexture(diffusedTexture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(maskProgram)
      gl.deleteProgram(viewProgram)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    // image 换了才重建整条管线；其余参数走 settingsRef，不必重来
  }, [image, reduced])

  return (
    <div
      ref={rootRef}
      className={cn('dither-veil', className)}
      style={style}
      data-ready={ready && !fallback ? 'true' : undefined}
      data-static={fallback || reduced ? 'true' : undefined}
      data-fit={fit}
    >
      <img className="dither-veil__still" src={image} alt={alt} loading="lazy" decoding="async" draggable={false} />
      <canvas ref={canvasRef} className="dither-veil__canvas" aria-hidden />
    </div>
  )
}
