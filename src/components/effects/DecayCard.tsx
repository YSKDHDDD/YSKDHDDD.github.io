import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import './DecayCard.css'

/**
 * 会散开的照片卡。
 *
 * 参考 reactbits 的 DecayCard：指针扫过，照片从边缘开始撕裂、溶掉，手停下来又慢慢
 * 合回去；没人理它时边缘也会自己轻微起毛。原版是 WebGL2 + 片元着色器做噪声域扭曲，
 * 数学部分照搬（simplex 噪声叠成湍流，把采样坐标推开），改的是它和页面接壤的地方：
 *
 *   - **画布正好等于卡片**。原版画布是卡片的 1.24 倍，卡面内容再内缩 8.33%，为的是给
 *     撕裂边缘留一点抗锯齿余量；代价是照片实际比卡片小一圈，四边总有一条对不齐的缝。
 *     这里把设计空间直接改成卡面本身，uv 落在卡上，边缘靠 alpha 羽化一像素解决。
 *   - **纵向设计尺寸按实际宽高比算**（uCardH）。原版把设计空间写死成 600×750（4:5），
 *     而默认的 300×400 是 3:4 —— 两处比例不一致，cover 裁剪的方向会错。现在只有宽度
 *     是常数，高度跟着容器的宽高比走，卡片多大都对。
 *   - **底下永远压一张真 `<img>`**。预渲染产物里 canvas 是空的，JS 没跑起来或显卡被
 *     禁用时不能只剩一个空框；纹理就绪后这张图才让位。WebGL 上下文丢了也退回到它。
 *   - **prefers-reduced-motion 下不建 GL**。撕裂本身是位移，对前庭敏感的人是实打实的
 *     干扰；这里不是「减弱」，是整张卡退回成一张静态照片。
 *
 * 性能上承袭原版：IntersectionObserver 判定离屏就停 rAF、静止 0.25s 后停帧、idle 动画
 * 隔帧绘制。指针事件只记坐标，真正的计算全在下一帧里做一次。
 */

export interface DecayCardProps {
  /** 照片地址 */
  image: string
  alt: string
  width?: number
  height?: number
  /** 撕裂的最大幅度，0–2 */
  intensity?: number
  /** 指针要「多慢」才不撕裂：0 迟钝、1 敏感 */
  sensitivity?: number
  /** 指针停在卡上时保留的基础撕裂量，0–1 */
  hoverDecay?: number
  /** 手停下来后合回去的时间常数（秒） */
  recovery?: number
  /** 没人碰时边缘自己起毛的幅度，0–1；0 就是完全静止 */
  idle?: number
  /** 碎块大小：0 是大片融化、1 是细碎渣 */
  grain?: number
  /** 噪声层数，1–8，越多边缘越毛糙 */
  detail?: number
  /** 换一套撕裂图案（就是换一个噪声种子） */
  pattern?: number
  /** 撕裂过程中的翻涌速度，0 静止 */
  flow?: number
  /** 撕裂处错开 RGB 通道的幅度，0–2 */
  chroma?: number
  /** 卡片朝指针漂移的像素数 */
  travel?: number
  /** 卡片随横向位移倾斜的角度 */
  tilt?: number
  /** window：指针在页面任何地方都能撕；card：只在悬停时响应 */
  scope?: 'window' | 'card'
  /** 圆角（交给着色器切，不用 overflow: hidden） */
  radius?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

const VERTEX = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`

/**
 * 着色器在一个「设计空间」里算：宽固定 600 单位，高按卡片宽高比推出 uCardH。
 * 画布像素除以 uUnit 就是设计单位，所以卡面的四个角正好落在 (0,0)–(600,uCardH)。
 */
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform vec2 uSize;
uniform vec2 uImageSize;
uniform float uUnit;
uniform float uCardH;
uniform float uScale;
uniform float uIdle;
uniform float uFrequency;
uniform int uOctaves;
uniform float uSeed;
uniform float uRadius;
uniform float uTime;
uniform float uFlow;
uniform float uChroma;
uniform float uGray;
uniform float uReady;
in vec2 vUv;
out vec4 fragColor;

vec4 permute(vec4 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n = 1.0 / 7.0;
  vec3 ns = n * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float turbulence(vec2 p, float z) {
  float sum = 0.0;
  float amp = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uOctaves) break;
    sum += abs(snoise(vec3(p, z))) * amp;
    p = p * 2.0 + 19.19;
    amp *= 0.5;
  }
  return clamp(sum * 0.45 + 0.231, 0.0, 1.0);
}

float roundedBox(vec2 p, vec2 extent, float r) {
  vec2 q = abs(p) - extent + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec3 sampleImage(vec2 view) {
  vec2 uv = view / vec2(600.0, uCardH);
  float card = 600.0 / uCardH;
  float image = uImageSize.x / max(1.0, uImageSize.y);
  vec2 scale = card > image ? vec2(1.0, image / card) : vec2(card / image, 1.0);
  return texture(uImage, (uv - 0.5) * scale + 0.5).rgb;
}

void main() {
  // 注意不能叫 half：它是 GLSL ES 的保留字，编译器直接拒绝整个着色器
  vec2 halfSize = vec2(300.0, uCardH * 0.5);
  vec2 view = halfSize + (vUv * uSize - uSize * 0.5) / uUnit;

  // 离边框越近越容易碎：照片中间始终保持可读，烂掉的是轮廓。
  float inside = min(min(view.x, 600.0 - view.x), min(view.y, uCardH - view.y));
  float rim = 1.0 - smoothstep(0.0, 160.0, inside);

  // 没人碰的时候：边缘缓慢起毛（整圈都有底噪），卡面中间偶尔飘一块很淡的斑。
  float drift = snoise(vec3(view * 0.004 + uSeed * 0.37, uTime * 0.12)) * 0.5 + 0.5;
  float idle = uIdle * mix(smoothstep(0.55, 0.95, drift) * 0.5, 0.25 + 0.75 * smoothstep(0.3, 0.8, drift), rim);

  // 中心只给 12%：撕裂是轮廓的事，脸得留着可读。原先的 0.2 在最高速时会横着撕过脸颊。
  float scale = uScale * mix(0.12, 1.0, rim) + idle * 120.0;
  vec2 offset = vec2(0.0);
  if (scale > 0.01) {
    vec2 p = view * uFrequency + vec2(uSeed * 17.31, uSeed * 9.17);
    float z = uTime * (uFlow * 0.35 + uIdle * 0.5) + uSeed * 3.1;
    float red = turbulence(p, z);
    float blue = turbulence(p + vec2(31.7, 47.3), z + 5.3);
    offset = scale * (vec2(red, blue) - 0.5);
  }

  vec2 source = view + offset;
  float edge = roundedBox(source - halfSize, halfSize, uRadius);
  float alpha = (1.0 - smoothstep(-0.75 / uUnit, 0.75 / uUnit, edge)) * uReady;
  vec3 color = sampleImage(source);

  // 撕裂处把通道拉开一点：老胶片的味道，幅度小的时候就是「糊」，大的时候是「错位」。
  if (uChroma > 0.0) {
    vec2 split = offset * uChroma * 0.08 + vec2(uChroma * min(scale, 200.0) * 0.012, 0.0);
    color.r = sampleImage(source + split).r;
    color.b = sampleImage(source - split).b;
  }

  color = mix(color, vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), uGray);
  fragColor = vec4(color * alpha, alpha);
}`

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * 超出 travel 之后还让指针继续拽，但拽不动那么多了。
 * 少这个函数，指针一过中线卡片就「啪」地贴到边界上，手感是断的。
 */
const soften = (value: number, bound: number) => {
  if (value > bound) return bound + (value - bound) * 0.2
  if (value < -bound) return -bound + (value + bound) * 0.2
  return value
}

/** 漂移/倾斜的跟随时间常数：160ms，比撕裂的 80ms 慢一点，两种运动才不像一个东西 */
const FOLLOW = 0.16
/** 指向性判定：撕裂是「越快越碎」，而这个底数决定多快算快 */
const SPEED_FLOOR = 2400
const SPEED_RANGE = 2100

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  gl.deleteShader(shader)
  return null
}

export default function DecayCard({
  image,
  alt,
  width = 300,
  height = 400,
  intensity = 0.5,
  sensitivity = 0.5,
  hoverDecay = 0.05,
  recovery = 0.6,
  idle = 0.35,
  grain = 0.25,
  detail = 5,
  pattern = 4,
  flow = 0,
  chroma = 0,
  travel = 50,
  tilt = 10,
  scope = 'window',
  radius = 0,
  className,
  style,
  children,
}: DecayCardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loadRef = useRef<((src: string) => void) | null>(null)
  const wakeRef = useRef<(() => void) | null>(null)
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)
  const reduced = usePrefersReducedMotion()

  /*
   * 参数归一化后挂在 ref 上给动画循环读。写 ref 放在 layout 阶段而不是渲染阶段：
   * 渲染期写 ref 在并发模式下会被丢弃的渲染也执行一次，读到的是哪一次的 props 说不清。
   */
  const settings = {
    intensity: clamp(intensity, 0, 2),
    sensitivity: clamp(sensitivity, 0, 1),
    hoverDecay: clamp(hoverDecay, 0, 1),
    recovery: Math.max(0.05, recovery),
    frequency: 0.003 + clamp(grain, 0, 1) * 0.047,
    octaves: clamp(Math.round(detail), 1, 8),
    seed: Math.round(pattern),
    idle: clamp(idle, 0, 1),
    flow: clamp(flow, 0, 2),
    chroma: clamp(chroma, 0, 2),
    travel: Math.max(0, travel),
    tilt: clamp(tilt, 0, 45),
    scope: scope === 'card' ? ('card' as const) : ('window' as const),
    radius: Math.max(0, radius),
  }
  const settingsRef = useRef(settings)

  useLayoutEffect(() => {
    settingsRef.current = settings
  })

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return undefined

    // 不建 GL：这张卡就是一张照片，没有撕裂，也没有任何运动
    if (reduced) return undefined

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })
    let program: WebGLProgram | null = null
    let texture: WebGLTexture | null = null
    let buffer: WebGLBuffer | null = null
    const uniforms: Record<string, WebGLUniformLocation | null> = {}

    if (gl) {
      const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
      const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
      if (vertex && fragment) {
        program = gl.createProgram()
        gl.attachShader(program, vertex)
        gl.attachShader(program, fragment)
        gl.bindAttribLocation(program, 0, 'position')
        gl.linkProgram(program)
        gl.deleteShader(vertex)
        gl.deleteShader(fragment)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          gl.deleteProgram(program)
          program = null
        }
      }
      if (program) {
        // 一个盖住整个裁剪空间的三角形，比两个三角形少一次接缝
        buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

        texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        // 纹理就绪前先挂一个 1×1 的透明像素：uReady 会把它挡住，但采样不能是空的
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([0, 0, 0, 0]),
        )
        for (const name of [
          'uImage',
          'uSize',
          'uImageSize',
          'uUnit',
          'uCardH',
          'uScale',
          'uIdle',
          'uFrequency',
          'uOctaves',
          'uSeed',
          'uRadius',
          'uTime',
          'uFlow',
          'uChroma',
          'uGray',
          'uReady',
        ]) {
          uniforms[name] = gl.getUniformLocation(program, name)
        }
      }
    }

    const state = {
      /** 漂移与倾斜的当前值 */
      x: 0,
      y: 0,
      rotate: 0,
      /** 撕裂程度，0–1 */
      level: 0,
      time: 0,
      cursorX: window.innerWidth / 2,
      cursorY: window.innerHeight / 2,
      lastX: window.innerWidth / 2,
      lastY: window.innerHeight / 2,
      /** 指针进过页面没有：没进来之前 window 模式不该按「屏幕中心」漂 */
      seen: false,
      hovered: false,
      visible: true,
      ready: false,
      imageWidth: 1,
      imageHeight: 1,
    }

    let raf = 0
    let last = performance.now()
    let alive = true
    /** 连续静止了多久，用来决定什么时候停帧 */
    let calm = 0
    let tick = 0

    if (!program) setFallback(true)

    const draw = () => {
      if (!gl || !program) return
      const s = settingsRef.current
      const w = canvas.width
      const h = canvas.height
      if (!w || !h) return

      // 设计空间：宽 600 单位，高按卡面比例推；画布像素除以 unit 就是设计单位
      const unit = w / 600
      const cardH = (600 * h) / w

      gl.viewport(0, 0, w, h)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(uniforms.uImage, 0)
      gl.uniform2f(uniforms.uSize, w, h)
      gl.uniform2f(uniforms.uImageSize, state.imageWidth, state.imageHeight)
      gl.uniform1f(uniforms.uUnit, unit)
      gl.uniform1f(uniforms.uCardH, cardH)
      gl.uniform1f(uniforms.uScale, state.level * s.intensity * 440)
      gl.uniform1f(uniforms.uIdle, s.idle)
      gl.uniform1f(uniforms.uFrequency, s.frequency)
      gl.uniform1i(uniforms.uOctaves, s.octaves)
      gl.uniform1f(uniforms.uSeed, s.seed)
      gl.uniform1f(uniforms.uRadius, (s.radius * 600) / Math.max(1, canvas.clientWidth))
      gl.uniform1f(uniforms.uTime, state.time)
      gl.uniform1f(uniforms.uFlow, s.flow)
      gl.uniform1f(uniforms.uChroma, s.chroma)
      gl.uniform1f(uniforms.uGray, 0)
      gl.uniform1f(uniforms.uReady, state.ready ? 1 : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const frame = (now: number) => {
      raf = 0
      if (!alive) return
      const s = settingsRef.current
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      state.time += dt

      // 指针速度用「上一帧到这一帧」的位移算，松手或停住时自然趋近 0
      const speed = Math.hypot(state.cursorX - state.lastX, state.cursorY - state.lastY) / dt
      state.lastX = state.cursorX
      state.lastY = state.cursorY

      let nx = 0
      let ny = 0
      if (s.scope === 'card') {
        if (state.hovered) {
          const rect = root.getBoundingClientRect()
          nx = clamp(((state.cursorX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -1, 1)
          ny = clamp(((state.cursorY - rect.top) / Math.max(1, rect.height)) * 2 - 1, -1, 1)
        }
      } else if (state.seen) {
        nx = clamp((state.cursorX / Math.max(1, window.innerWidth)) * 2 - 1, -1, 1)
        ny = clamp((state.cursorY / Math.max(1, window.innerHeight)) * 2 - 1, -1, 1)
      }

      const follow = 1 - Math.exp(-dt / FOLLOW)
      const targetX = soften(nx * 120, s.travel)
      const targetY = soften(ny * 120, s.travel)
      const targetRotate = nx * s.tilt
      state.x += (targetX - state.x) * follow
      state.y += (targetY - state.y) * follow
      state.rotate += (targetRotate - state.rotate) * follow

      const active = s.scope === 'window' || state.hovered
      let wanted = active
        ? clamp(speed / (SPEED_FLOOR - SPEED_RANGE * s.sensitivity), 0, 1) ** 2
        : 0
      // 停在卡上时保留一点撕裂：让「我的手在这里」这件事有反馈
      if (state.hovered) wanted = Math.max(wanted, s.hoverDecay)

      // 撕开快、合回慢：200ms 的差别就够让松手那一刻显得「有惯性」
      const tau = wanted > state.level ? 0.08 : s.recovery
      state.level += (wanted - state.level) * (1 - Math.exp(-dt / tau))

      root.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) rotate(${state.rotate.toFixed(3)}deg)`

      const settling =
        Math.abs(targetX - state.x) + Math.abs(targetY - state.y) + Math.abs(targetRotate - state.rotate) >
          0.05 ||
        Math.abs(wanted - state.level) > 0.002 ||
        (state.level > 0.002 && s.flow > 0) ||
        speed > 1
      const animating = s.idle > 0
      tick = (tick + 1) % 2
      if (settling || !animating || tick === 0) draw()

      calm = settling ? 0 : calm + dt
      if (state.visible && (calm < 0.25 || animating)) raf = requestAnimationFrame(frame)
    }

    const wake = () => {
      if (raf || !alive || !state.visible) return
      calm = 0
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    wakeRef.current = wake

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(root.clientWidth * dpr))
      const h = Math.max(1, Math.round(root.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      draw()
    }

    loadRef.current = (src: string) => {
      state.ready = false
      setReady(false)
      draw()
      if (!src) return
      const img = new Image()
      // 同源图片不需要跨域头；留着它反而会让某些缓存策略重新下载
      img.decoding = 'async'
      img.onload = () => {
        if (!alive) return
        if (!gl || !program || !texture) {
          setFallback(true)
          return
        }
        try {
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
          gl.generateMipmap(gl.TEXTURE_2D)
          state.imageWidth = img.naturalWidth || 1
          state.imageHeight = img.naturalHeight || 1
          state.ready = true
          draw()
          // 画完再收掉底下的静态图：反过来会闪一帧空框
          setReady(true)
          setFallback(false)
        } catch {
          setFallback(true)
        }
      }
      img.onerror = () => {
        if (alive) setFallback(true)
      }
      img.src = src
    }

    const onMove = (event: PointerEvent) => {
      state.cursorX = event.clientX
      state.cursorY = event.clientY
      if (!state.seen) {
        state.seen = true
        state.lastX = event.clientX
        state.lastY = event.clientY
      }
      wake()
    }
    const onEnter = () => {
      state.hovered = true
      wake()
    }
    const onLeave = () => {
      state.hovered = false
      wake()
    }
    // 上下文丢失（切换显卡、显存吃紧、被系统回收）时退回静态图，而不是留一块黑
    const onLost = (event: Event) => {
      event.preventDefault()
      setFallback(true)
      setReady(false)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(root)
    const visibility = new IntersectionObserver((entries) => {
      state.visible = entries.some((entry) => entry.isIntersecting)
      if (state.visible) wake()
    })
    visibility.observe(root)
    window.addEventListener('pointermove', onMove, { passive: true })
    canvas.addEventListener('webglcontextlost', onLost)
    root.addEventListener('pointerenter', onEnter)
    root.addEventListener('pointerleave', onLeave)
    resize()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      wakeRef.current = null
      loadRef.current = null
      resizeObserver.disconnect()
      visibility.disconnect()
      window.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('webglcontextlost', onLost)
      root.removeEventListener('pointerenter', onEnter)
      root.removeEventListener('pointerleave', onLeave)
      if (gl) {
        gl.deleteTexture(texture)
        gl.deleteBuffer(buffer)
        gl.deleteProgram(program)
      }
    }
  }, [reduced])

  useEffect(() => {
    loadRef.current?.(image)
  }, [image])

  // 参数变了要重新画一帧，否则改 props 得等下一次指针移动才生效
  useEffect(() => {
    wakeRef.current?.()
  })

  return (
    <div
      ref={rootRef}
      className={cn('decay-card', className)}
      style={{ width, height, ...style }}
      /* ready 只说明纹理画好过；降级或上下文丢失之后它不该再压住那张静态图 */
      data-ready={ready && !fallback && !reduced ? 'true' : undefined}
      data-static={fallback || reduced ? 'true' : undefined}
    >
      <img
        className="decay-card__still"
        src={image}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        style={{ borderRadius: radius }}
      />
      <canvas ref={canvasRef} className="decay-card__canvas" aria-hidden />
      {children ? <div className="decay-card__content">{children}</div> : null}
    </div>
  )
}
