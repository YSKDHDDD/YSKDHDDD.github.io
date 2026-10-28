import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import './LanyardBadge.css'

/**
 * 挂在绳子上的工牌。
 *
 * 参考的是 reactbits 的 Lanyard，但没照搬实现：那边是 three + rapier + 一个 .glb
 * 卡片模型，为一张工牌拉进来 600KB 的 3D 管线，和这一页「一屏只留一个常驻动效」
 * 的预算对不上。这里换成 Verlet 绳 + CSS 3D：
 *   - 绳子用 canvas 画成带子，物理是真的（重力、约束、阻尼），手感不假；
 *   - 卡片是 DOM，文字是真字，可选中、可读屏、跟着主题走；
 *   - 3D 只用一个 rotateY，倾斜量来自末端横向速度，够用且每帧只写一次 transform。
 *
 * 尺寸全部按容器算，换视口不用改数字。
 */

/** 绳子的分段数：14 段够顺，再多就是白给约束求解加迭代 */
const SEGMENTS = 14
/** 重力，写成「每秒位移多少倍容器高度」，换尺寸手感不跟着变 */
const GRAVITY = 3.2
const DAMPING = 0.99
const CONSTRAINT_PASSES = 8
const FIXED_STEP = 1 / 60

interface Point {
  x: number
  y: number
  px: number
  py: number
}

export interface LanyardBadgeProps {
  /** 工牌上的大字 */
  handle: string
  role: string
  /** 底部编号，像真工牌那样 */
  serial?: string
  className?: string
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function LanyardBadge({ handle, role, serial = 'ME · 001', className }: LanyardBadgeProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const card = cardRef.current
    if (!wrap || !canvas || !card) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ---- 几何：全部跟着容器尺寸重算 ----
    let width = 0
    let height = 0
    let cardW = 0
    let cardH = 0
    let restTop = 0
    let anchorY = 0
    let ropeLen = 0
    let strapWidth = 12
    let dpr = 1
    let brand = '#8b8cf7'
    let brandKey = ''

    const points: Point[] = Array.from({ length: SEGMENTS + 1 }, () => ({ x: 0, y: 0, px: 0, py: 0 }))

    let drag: { x: number; y: number } | null = null
    let angle = 0
    let tilt = 0
    let raf = 0
    let lastTime = 0
    let accumulator = 0

    const readBrand = () => {
      const key = document.documentElement.dataset.theme ?? 'default'
      if (key === brandKey) return
      brandKey = key
      const value = getComputedStyle(wrap).getPropertyValue('--brand').trim()
      if (value) brand = value
    }

    const applyCard = () => {
      const end = points[SEGMENTS]
      const dx = end.x - width / 2
      const dy = end.y - restTop
      card.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${angle.toFixed(4)}rad) rotateY(${tilt.toFixed(2)}deg)`
    }

    const paint = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // 带子的两条边：沿每段的法线偏移半个带宽
      const left: Array<[number, number]> = []
      const right: Array<[number, number]> = []
      for (let i = 0; i <= SEGMENTS; i += 1) {
        const a = points[Math.max(0, i - 1)]
        const b = points[Math.min(SEGMENTS, i + 1)]
        const tx = b.x - a.x
        const ty = b.y - a.y
        const len = Math.hypot(tx, ty) || 1
        const nx = -ty / len
        const ny = tx / len
        const half = strapWidth / 2
        left.push([points[i].x + nx * half, points[i].y + ny * half])
        right.push([points[i].x - nx * half, points[i].y - ny * half])
      }

      // 过点用二次贝塞尔，边缘不会有折角
      const edge = (list: Array<[number, number]>) => {
        ctx.moveTo(list[0][0], list[0][1])
        for (let i = 1; i < list.length - 1; i += 1) {
          const cx = (list[i][0] + list[i + 1][0]) / 2
          const cy = (list[i][1] + list[i + 1][1]) / 2
          ctx.quadraticCurveTo(list[i][0], list[i][1], cx, cy)
        }
        const last = list[list.length - 1]
        ctx.lineTo(last[0], last[1])
      }

      ctx.beginPath()
      edge(left)
      for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i][0], right[i][1])
      ctx.closePath()
      ctx.fillStyle = brand
      ctx.fill()

      // 两侧各压一道极淡的明暗，带子才有圆柱感
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const shade = (list: Array<[number, number]>, color: string, wide: number) => {
        ctx.beginPath()
        edge(list)
        ctx.strokeStyle = color
        ctx.lineWidth = wide
        ctx.stroke()
      }
      shade(left, 'rgba(255,255,255,0.22)', strapWidth * 0.22)
      shade(right, 'rgba(0,0,0,0.22)', strapWidth * 0.26)

      // 中间一道缝线
      ctx.beginPath()
      edge(points.map((p) => [p.x, p.y] as [number, number]))
      ctx.setLineDash([3, 4])
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255,255,255,0.34)'
      ctx.stroke()
      ctx.setLineDash([])

      // 织带斜纹：clip 复用同一路径，纹路只在带子内部
      ctx.save()
      ctx.beginPath()
      edge(left)
      for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i][0], right[i][1])
      ctx.closePath()
      ctx.clip()
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 2
      for (let x = -height; x < width + height; x += 9) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x + height * 0.4, height)
        ctx.stroke()
      }
      ctx.restore()

      // 卡片顶上的金属扣：整块画在卡片上沿之上，别被卡片盖住
      const end = points[SEGMENTS]
      ctx.save()
      ctx.translate(end.x, end.y)
      ctx.rotate(angle)
      const clipW = strapWidth * 1.2
      const clipH = strapWidth * 1.6
      const radius = Math.min(3, clipW / 3)
      ctx.beginPath()
      ctx.roundRect(-clipW / 2, -clipH, clipW, clipH, radius)
      const metal = ctx.createLinearGradient(-clipW / 2, 0, clipW / 2, 0)
      metal.addColorStop(0, '#767e90')
      metal.addColorStop(0.42, '#d6dbe4')
      metal.addColorStop(1, '#626a7c')
      ctx.fillStyle = metal
      ctx.fill()
      ctx.restore()

      // 顶边淡出：带子是从画面外垂下来的，不该有一个齐头断口
      const fade = Math.min(height * 0.16, 110)
      const mask = ctx.createLinearGradient(0, 0, 0, fade)
      mask.addColorStop(0, 'rgba(0,0,0,1)')
      mask.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = mask
      ctx.fillRect(0, 0, width, fade)
      ctx.globalCompositeOperation = 'source-over'
    }

    const seed = () => {
      for (let i = 0; i <= SEGMENTS; i += 1) {
        const y = anchorY + (ropeLen * i) / SEGMENTS
        points[i].x = width / 2
        points[i].y = y
        points[i].px = width / 2
        points[i].py = y
      }
      angle = 0
      tilt = 0
      drag = null
    }

    const layout = () => {
      const rect = wrap.getBoundingClientRect()
      width = rect.width
      height = rect.height
      // display:none（窄屏）时没有尺寸：停掉循环，别拿 0 去跑物理
      if (!width || !height) {
        stop()
        return
      }

      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      // 卡片宽同时受容器宽和高约束，否则窄屏上会顶出框
      cardW = Math.round(Math.min(width * 0.72, height * 0.4))
      // 1.55 接近真实工牌（54×86）的长宽比，1.36 会显得又矮又方
      cardH = Math.round(cardW * 1.55)
      restTop = Math.round(height * 0.22)
      anchorY = -Math.round(height * 0.16)
      ropeLen = restTop - anchorY
      strapWidth = Math.max(9, Math.min(16, width * 0.05))

      wrap.style.setProperty('--card-w', `${cardW}px`)
      wrap.style.setProperty('--card-h', `${cardH}px`)
      wrap.style.setProperty('--rest-top', `${restTop}px`)

      // 尺寸一变，旧坐标会把卡片甩到框外，直接回到静止位
      seed()
      readBrand()
      paint()
      applyCard()
      if (!reduced) start()
    }

    const step = (dt: number) => {
      const gravity = height * GRAVITY
      const segment = ropeLen / SEGMENTS

      for (let i = 1; i <= SEGMENTS; i += 1) {
        const p = points[i]
        const vx = (p.x - p.px) * DAMPING
        const vy = (p.y - p.py) * DAMPING
        p.px = p.x
        p.py = p.y
        p.x += vx
        p.y += vy + gravity * dt * dt
      }

      points[0].x = width / 2
      points[0].y = anchorY

      if (drag) {
        points[SEGMENTS].x = drag.x
        points[SEGMENTS].y = drag.y
      }

      for (let pass = 0; pass < CONSTRAINT_PASSES; pass += 1) {
        for (let i = 0; i < SEGMENTS; i += 1) {
          const a = points[i]
          const b = points[i + 1]
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
        if (drag) {
          points[SEGMENTS].x = drag.x
          points[SEGMENTS].y = drag.y
        }
      }

      /*
       * 末端限位：允许甩出容器两侧一点，但别让卡片整块压到正文上。
       * 留 20% 卡宽的余量 —— 完全限制在框内的话，300px 的容器里只剩 ±38px 的活动范围，
       * 拖起来像钉住了。
       */
      const end = points[SEGMENTS]
      end.x = clamp(end.x, cardW * 0.2, width - cardW * 0.2)
      end.y = clamp(end.y, restTop * 0.45, Math.max(restTop, height - cardH - 6))
    }

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame)
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : FIXED_STEP
      lastTime = time
      accumulator = Math.min(accumulator + delta, 0.2)

      readBrand()
      while (accumulator >= FIXED_STEP) {
        step(FIXED_STEP)
        accumulator -= FIXED_STEP
      }

      // 卡片角度跟着末端绳子的方向，但慢半拍 —— 这个「慢」就是重量感
      const end = points[SEGMENTS]
      const before = points[SEGMENTS - 1]
      const target = clamp(Math.atan2(end.x - before.x, end.y - before.y), -1.1, 1.1)
      const diff = Math.atan2(Math.sin(target - angle), Math.cos(target - angle))
      angle += diff * 0.32

      // 横向速度决定侧倾：甩得越快越接近侧脸
      const vx = (end.x - end.px) * 60
      const targetTilt = clamp(-vx / 12, -34, 34)
      tilt += (targetTilt - tilt) * 0.22

      paint()
      applyCard()

      /*
       * 停下来就真的停：绳子和卡片都不动了还每帧重绘，等于给一屏静态画面
       * 付全程帧预算。这也是这一页「一屏只留一个常驻动效」说法的另一半 ——
       * 极光在动，工牌就只是挂着。
       */
      if (!drag && speed() < 0.06 && Math.abs(angle) < 0.004 && Math.abs(tilt) < 0.4) {
        stop()
      }
    }

    /** 整条绳子里最快的那一段，用来判断是否已经静止 */
    const speed = () => {
      let max = 0
      for (let i = 1; i <= SEGMENTS; i += 1) {
        const p = points[i]
        max = Math.max(max, Math.abs(p.x - p.px), Math.abs(p.y - p.py))
      }
      return max
    }

    const start = () => {
      if (raf || reduced) return
      lastTime = 0
      accumulator = 0
      raf = requestAnimationFrame(frame)
    }

    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }

    // ---- 拖拽：整张卡片都能抓，抓哪儿就从哪儿跟手 ----
    let grab = { x: 0, y: 0 }

    const onPointerDown = (event: PointerEvent) => {
      if (reduced) return
      event.preventDefault()
      try {
        // 合成事件（自动化测试）里没有真实指针，capture 会抛；抓不到也不影响拖拽
        card.setPointerCapture(event.pointerId)
      } catch {
        /* 忽略 */
      }
      const rect = wrap.getBoundingClientRect()
      const end = points[SEGMENTS]
      grab = {
        x: end.x - (event.clientX - rect.left),
        y: end.y - (event.clientY - rect.top),
      }
      drag = { x: end.x, y: end.y }
      card.dataset.dragging = 'true'
      card.dataset.touched = 'true'
      start()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return
      const rect = wrap.getBoundingClientRect()
      drag = {
        x: event.clientX - rect.left + grab.x,
        y: event.clientY - rect.top + grab.y,
      }
    }

    const onPointerUp = () => {
      if (!drag) return
      drag = null
      delete card.dataset.dragging

      // 松手时把速度打七折：Verlet 会把最后一段位移当成速度，直接用容易甩飞
      const end = points[SEGMENTS]
      end.px = end.x - (end.x - end.px) * 0.7
      end.py = end.y - (end.y - end.py) * 0.7
    }

    card.addEventListener('pointerdown', onPointerDown)
    card.addEventListener('pointermove', onPointerMove)
    card.addEventListener('pointerup', onPointerUp)
    card.addEventListener('pointercancel', onPointerUp)

    const observer = new ResizeObserver(layout)
    observer.observe(wrap)

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (!reduced) start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    layout()
    if (!reduced) start()

    return () => {
      stop()
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      card.removeEventListener('pointerdown', onPointerDown)
      card.removeEventListener('pointermove', onPointerMove)
      card.removeEventListener('pointerup', onPointerUp)
      card.removeEventListener('pointercancel', onPointerUp)
    }
  }, [reduced])

  return (
    <div ref={wrapRef} className={cn('lanyard', className)}>
      <canvas ref={canvasRef} className="lanyard__strap" aria-hidden />
      <div ref={cardRef} className="lanyard__card">
        <span className="lanyard__mark" aria-hidden>
          学
        </span>
        <p className="lanyard__brand">
          <span className="lanyard__dot" aria-hidden />
          学习外脑
        </p>
        <p className="lanyard__handle">{handle}</p>
        <p className="lanyard__role">{role}</p>
        <p className="lanyard__quote">写能读懂的代码，做摸得到的界面。</p>
        <span className="lanyard__barcode" aria-hidden />
        <p className="lanyard__foot">
          <span>{serial}</span>
          <span className="lanyard__hint">拖一下</span>
        </p>
      </div>
    </div>
  )
}
