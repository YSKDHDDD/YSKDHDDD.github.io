/**
 * 工牌绳子 + 卡片姿态的纯数值模型。
 *
 * 为什么单独一个文件：手感是靠数字调的，不是靠看一眼截图判断的。
 * 这一层不碰 DOM、不读 CSS、不依赖 rAF，可以扔进 Node 里按 60fps 逐帧跑，
 * 把「跟手落后多少像素、甩出去飞多远、荡几下停」直接打印出来。
 * 组件只负责把结果画到 canvas / 写进 transform。
 *
 * 坐标：容器左上角为原点，单位 px。
 */

/** 绳子的分段数：14 段够顺，再多就是白给约束求解加迭代 */
export const SEGMENTS = 14

/**
 * 手感参数集中在这里。
 *
 * 分开一个个 const 写起来好看，但调手感要同时动三四个数，散开就没法扫参数。
 * 收成一个对象之后，测试台可以在 Node 里成组覆盖、逐组打印结果，
 * 挑出想要的组合再固化成默认值。
 */
export const TUNING = {
  /**
   * 重力倍数（每秒位移多少倍容器高度）。这个值要和「像素当多少米」对齐：
   * 一根 239px 的绳子当作 25cm，比例尺约 950px/m，真实重力就是约 9300px/s²，
   * 即容器高的 15 倍。写小了会像泡在水里慢慢摆。
   */
  gravity: 12,
  /** 每步速度保留率：0.99 一秒只掉 45%，荡七八秒才停；0.975 一秒掉到两成，约 4 秒停下 */
  damping: 0.975,
  /** 约束迭代遍数。每遍把误差推进一段，14 段链要推到底，20 遍远远不够（见 step 里的注释） */
  passes: 120,

  /**
   * 牵引刚度（每秒）。距离近时接近刚性，拉得越远越软 ——
   * 橡皮筋的两段式，换来的是「拖一个有重量的东西」而不是「拖动一个矩形」。
   * 注意它是在跟绳子的约束抢位置：绷紧的绳子会吃掉横向牵引，
   * 所以这个数要比直觉大得多。
   */
  pullBase: 90,
  pullSlope: 2.2,
  pullFree: 8,

  /**
   * 摆角：欠阻尼弹簧。阻尼比是整段手感里最敏感的一个数 ——
   * 调到 0.6 以上就像一块铁片，0.2 以下会自己晃个不停。
   */
  swingW: 9.5,
  swingZeta: 0.4,
  /** 目标摆角上限（rad），约 17°；实际值会过冲一点，另有一层硬上限 */
  swingLimit: 0.3,
  swingMax: 0.6,
  /** 挂点加速度 → 摆角的换算。调大就是更夸张的甩动 */
  swingGain: 5e-5,
  /**
   * 加速度上限（px/s²）。松手那一帧速度突变，原始加速度能到一万八 ——
   * 不封顶的话摆角目标直接顶到极限，卡片会像被抽了一鞭子。
   */
  swingAxMax: 5000,

  /** 侧倾（rotateY）：横向速度 → 角度，让卡片在快速拖动时「转过去」一点 */
  tiltGain: 0.02,
  tiltLimit: 22,

  /** 速度/加速度的平滑系数：原始数值来自逐帧差值，不平滑会被噪声带得一直抖 */
  velSmooth: 0.32,
  accSmooth: 0.22,
  /** 松手时传给绳子的最大单帧位移，防止一甩就飞出框 */
  throwMax: 34,
}

export type Tuning = typeof TUNING

export interface Point {
  x: number
  y: number
  px: number
  py: number
}

export interface LanyardGeometry {
  width: number
  height: number
  cardW: number
  cardH: number
  restTop: number
  anchorY: number
  ropeLen: number
  strapWidth: number
}

export interface LanyardBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export class Lanyard {
  readonly points: Point[]
  readonly geometry: LanyardGeometry = {
    width: 0,
    height: 0,
    cardW: 0,
    cardH: 0,
    restTop: 0,
    anchorY: 0,
    ropeLen: 0,
    strapWidth: 12,
  }

  readonly bounds: LanyardBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 }

  /** 摆角（rad，正 = 卡片底部向左） */
  swing = 0
  /** 侧倾（deg） */
  tilt = 0
  dragging = false

  private hand: { x: number; y: number } | null = null
  private grab = { x: 0, y: 0 }
  /** 挂点（卡片上沿中点）的平滑速度与加速度，单位 px/s、px/s² */
  private clipVx = 0
  private clipVy = 0
  private clipAx = 0
  private lastX = 0
  private lastY = 0
  private lastClipVx = 0
  private swingVel = 0
  private readonly segments: number

  constructor(segments: number = SEGMENTS) {
    this.segments = segments
    this.points = Array.from({ length: segments + 1 }, () => ({ x: 0, y: 0, px: 0, py: 0 }))
  }

  /** 容器尺寸变了：重算几何，回到静止位 */
  resize(width: number, height: number) {
    const g = this.geometry
    g.width = width
    g.height = height
    // 卡片宽同时受容器宽和高约束，否则窄屏上会顶出框
    g.cardW = Math.round(Math.min(width * 0.72, height * 0.4))
    // 1.55 接近真实工牌（54×86）的长宽比，1.36 会显得又矮又方
    g.cardH = Math.round(g.cardW * 1.55)
    g.restTop = Math.round(height * 0.22)
    g.anchorY = -Math.round(height * 0.16)
    g.ropeLen = g.restTop - g.anchorY
    g.strapWidth = Math.max(9, Math.min(16, width * 0.05))

    /*
     * 活动范围。留 20% 卡宽的余量 —— 完全收在框内的话，300px 的容器里只剩
     * ±38px，拖起来像钉住了。竖向给到「卡片刚好全露」为止。
     */
    this.bounds.minX = g.cardW * 0.2
    this.bounds.maxX = width - g.cardW * 0.2
    this.bounds.minY = Math.max(g.anchorY + g.ropeLen * 0.18, 12)
    this.bounds.maxY = Math.max(g.restTop, height - g.cardH - 6)

    this.reset()
  }

  /** 回到静止位，丢掉所有速度 */
  reset() {
    const g = this.geometry
    for (let i = 0; i <= this.segments; i += 1) {
      const y = g.anchorY + (g.ropeLen * i) / this.segments
      const p = this.points[i]
      p.x = g.width / 2
      p.y = y
      p.px = g.width / 2
      p.py = y
    }
    this.lastX = g.width / 2
    this.lastY = this.points[this.segments].y
    this.clipVx = 0
    this.clipVy = 0
    this.clipAx = 0
    this.lastClipVx = 0
    this.swing = 0
    this.swingVel = 0
    this.tilt = 0
    this.hand = null
    this.dragging = false
  }

  /** 按住：记下抓取偏移，保证「抓哪儿从哪儿跟手」 */
  beginDrag(x: number, y: number) {
    const end = this.points[this.segments]
    this.grab = { x: end.x - x, y: end.y - y }
    this.hand = { x: end.x, y: end.y }
    this.dragging = true
  }

  /** 移动：手心目标直接限位，而不是等末端去撞墙 —— 否则限位吃掉抓取偏移，回拖会跳 */
  moveHand(x: number, y: number) {
    if (!this.hand) return
    this.hand.x = clamp(x + this.grab.x, this.bounds.minX, this.bounds.maxX)
    this.hand.y = clamp(y + this.grab.y, this.bounds.minY, this.bounds.maxY)
  }

  /**
   * 松手：把「平滑速度」交给绳子。用最后一帧位移当速度是不行的 ——
   * 手停下来到松手之间总有几帧，那时位移接近 0，甩不出去。
   */
  endDrag() {
    if (!this.hand) return
    const end = this.points[this.segments]
    end.px = end.x - clamp(this.clipVx / 60, -TUNING.throwMax, TUNING.throwMax)
    end.py = end.y - clamp(this.clipVy / 60, -TUNING.throwMax, TUNING.throwMax)
    this.hand = null
    this.dragging = false
  }

  step(dt: number) {
    const g = this.geometry
    const { segments } = this
    const gravity = g.height * TUNING.gravity
    const segment = g.ropeLen / segments

    for (let i = 1; i <= segments; i += 1) {
      const p = this.points[i]
      const vx = (p.x - p.px) * TUNING.damping
      const vy = (p.y - p.py) * TUNING.damping
      p.px = p.x
      p.py = p.y
      p.x += vx
      p.y += vy + gravity * dt * dt
    }

    this.points[0].x = g.width / 2
    this.points[0].y = g.anchorY

    /*
     * 牵引而不是钉住。每帧只把末端朝手心挪一部分，剩下的距离留着 ——
     * 这段「没追上」的距离就是重量：慢慢拖时几乎看不见，一甩就明显落后。
     * 距离越远刚度越高，避免快速甩动时卡片掉队太远。
     */
    if (this.hand) {
      const end = this.points[segments]
      const dx = this.hand.x - end.x
      const dy = this.hand.y - end.y
      const dist = Math.hypot(dx, dy)
      const rate = TUNING.pullBase + Math.max(0, dist - TUNING.pullFree) * TUNING.pullSlope
      const k = 1 - Math.exp(-rate * dt)
      end.x += dx * k
      end.y += dy * k
    }

    /*
     * 绳子长度约束：逐段松弛（高斯-赛德尔）。
     *
     * 这里踩过两个坑，都记下来免得下次再试：
     *   1. 遍数给少了不行。每遍只把误差推进一段，14 段链要传到底，
     *      20 遍之后静置状态绳子还长着 8px —— 这 8px 就是一根弹簧，
     *      拖拽时它一直往回拽：手移 200px，卡片只走 70px，看着像卡死。
     *      收敛误差随遍数指数下降，给到 120 遍才稳（14 段，每帧 1680 次浮点运算，可忽略）。
     *   2. FABRIK 式双向投影看着更省，但正推会把末端位置从链形重算一遍，
     *      牵引加在末端上的位移直接被抹掉，卡片干脆不跟手。端点自由时不能用。
     */
    for (let pass = 0; pass < TUNING.passes; pass += 1) {
      for (let i = 0; i < segments; i += 1) {
        const a = this.points[i]
        const b = this.points[i + 1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 1
        const diff = (dist - segment) / dist
        if (i === 0) {
          b.x -= dx * diff
          b.y -= dy * diff
        } else {
          a.x += dx * diff * 0.5
          a.y += dy * diff * 0.5
          b.x -= dx * diff * 0.5
          b.y -= dy * diff * 0.5
        }
      }
    }

    // 兜底限位：牵引目标已经框住了，这里防的是甩动瞬间的过冲
    const end = this.points[segments]
    end.x = clamp(end.x, this.bounds.minX, this.bounds.maxX)
    end.y = clamp(end.y, this.bounds.minY, this.bounds.maxY)

    // ---- 速度与加速度：两层平滑，原始值逐帧跳得像噪声 ----
    const rawVx = (end.x - this.lastX) / dt
    const rawVy = (end.y - this.lastY) / dt
    this.lastX = end.x
    this.lastY = end.y
    this.clipVx += (rawVx - this.clipVx) * TUNING.velSmooth
    this.clipVy += (rawVy - this.clipVy) * TUNING.velSmooth
    const rawAx = (this.clipVx - this.lastClipVx) / dt
    this.lastClipVx = this.clipVx
    this.clipAx += (rawAx - this.clipAx) * TUNING.accSmooth

    /*
     * 摆角。挂点往右加速，质心因为惯性留在左边 —— 卡片底部甩向左（正摆角）。
     * 用弹簧而不是插值：松开手时目标归零，卡片会过冲一次再回摆，
     * 这一下是它最像实物的时候。
     */
    const drive = Math.abs(this.clipAx) < 80 ? 0 : clamp(this.clipAx, -TUNING.swingAxMax, TUNING.swingAxMax)
    const target = clamp(drive * TUNING.swingGain, -TUNING.swingLimit, TUNING.swingLimit)
    const accel = (target - this.swing) * TUNING.swingW * TUNING.swingW - 2 * TUNING.swingZeta * TUNING.swingW * this.swingVel
    this.swingVel += accel * dt
    this.swing = clamp(this.swing + this.swingVel * dt, -TUNING.swingMax, TUNING.swingMax)

    // ---- 侧倾：横向速度决定「转过脸」多少 ----
    const targetTilt = clamp(-this.clipVx * TUNING.tiltGain, -TUNING.tiltLimit, TUNING.tiltLimit)
    this.tilt += (targetTilt - this.tilt) * (1 - Math.exp(-12 * dt))
  }

  /** 末端（挂点）相对静止位的位移 */
  offset() {
    const end = this.points[this.segments]
    return { x: end.x - this.geometry.width / 2, y: end.y - this.geometry.restTop }
  }

  /** 整条绳子里最快的那一段，用来判断是否已经静止 */
  restSpeed() {
    let max = 0
    for (let i = 1; i <= this.segments; i += 1) {
      const p = this.points[i]
      max = Math.max(max, Math.abs(p.x - p.px), Math.abs(p.y - p.py))
    }
    return max
  }

  /** 停下来就真的停：还在动就别让调用方停掉 rAF */
  isSettled() {
    if (this.hand) return false
    return (
      this.restSpeed() < 0.06 &&
      Math.abs(this.swing) < 0.004 &&
      Math.abs(this.swingVel) < 0.01 &&
      Math.abs(this.tilt) < 0.4
    )
  }
}
