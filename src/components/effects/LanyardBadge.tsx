import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import { Lanyard } from './lanyardPhysics'
import './LanyardBadge.css'

/**
 * 挂在绳子上的工牌。
 *
 * 参考的是 reactbits 的 Lanyard，但没照搬实现：那边是 three + rapier + 一个 .glb
 * 卡片模型，为一张工牌拉进来 600KB 的 3D 管线，和这一页「一屏只留一个常驻动效」
 * 的预算对不上。这里换成 Verlet 绳 + CSS 3D：
 *   - 绳子用 canvas 画成带子，物理是真的（重力、约束、阻尼），手感不假；
 *   - 卡片是 DOM，文字是真字，可选中、可读屏、跟着主题走；
 *   - 3D 只用一个 rotateY，倾斜量来自横向速度，够用且每帧只写一次 transform。
 *
 * 物理在 ./lanyardPhysics.ts 里，不碰 DOM：那边能单独在 Node 里逐帧跑，
 * 手感是靠秒数、像素、角度这些数字调出来的，不是靠看一眼截图。
 * 这个文件只做三件事 —— 画带子、写 transform、把指针事件翻成「手心」。
 */

/** 固定步长：物理按 60Hz 推进，与显示器刷新率解耦，120Hz 屏上手感不会变快 */
const FIXED_STEP = 1 / 60

export interface LanyardBadgeProps {
  /** 工牌上的大字 */
  handle: string
  role: string
  /** 底部编号，像真工牌那样 */
  serial?: string
  className?: string
}

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

    const solver = new Lanyard()
    let dpr = 1
    let brand = '#8b8cf7'
    let brandKey = ''

    let raf = 0
    let lastTime = 0
    let accumulator = 0
    let pointerId: number | null = null

    const readBrand = () => {
      const key = document.documentElement.dataset.theme ?? 'default'
      if (key === brandKey) return
      brandKey = key
      const value = getComputedStyle(wrap).getPropertyValue('--brand').trim()
      if (value) brand = value
    }

    const applyCard = () => {
      const o = solver.offset()
      card.style.transform =
        `translate3d(${o.x.toFixed(2)}px, ${o.y.toFixed(2)}px, 0)` +
        ` rotate(${solver.swing.toFixed(4)}rad) rotateY(${solver.tilt.toFixed(2)}deg)`
    }

    const paint = () => {
      const g = solver.geometry
      const { points } = solver
      const n = points.length - 1
      const { width, height, strapWidth } = g

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // 带子的两条边：沿每段的法线偏移半个带宽
      const left: Array<[number, number]> = []
      const right: Array<[number, number]> = []
      for (let i = 0; i <= n; i += 1) {
        const a = points[Math.max(0, i - 1)]
        const b = points[Math.min(n, i + 1)]
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
      const end = points[n]
      ctx.save()
      ctx.translate(end.x, end.y)
      ctx.rotate(solver.swing)
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

    // ---- 拖拽：把客户端坐标翻成容器内坐标，其余交给 solver ----

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return
      const rect = wrap.getBoundingClientRect()
      solver.moveHand(event.clientX - rect.left, event.clientY - rect.top)
    }

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return
      solver.endDrag()
      delete card.dataset.dragging
      stopListening()
      start()
    }

    const stopListening = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      pointerId = null
    }

    const onPointerDown = (event: PointerEvent) => {
      if (reduced || event.button !== 0) return
      event.preventDefault()
      const rect = wrap.getBoundingClientRect()
      solver.beginDrag(event.clientX - rect.left, event.clientY - rect.top)
      pointerId = event.pointerId
      card.dataset.dragging = 'true'
      card.dataset.touched = 'true'
      try {
        // 抓住指针，鼠标甩出窗口也不会把事件丢掉
        card.setPointerCapture(event.pointerId)
      } catch {
        /* 合成事件里没有真实指针，抓不到也不影响拖拽 */
      }
      // 监听挂在 window 上：捕获失败（自动化 / 旧浏览器）时仍然能收到
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
      start()
    }

    const layout = () => {
      const rect = wrap.getBoundingClientRect()
      // display:none（窄屏）时没有尺寸：停掉循环，别拿 0 去跑物理
      if (!rect.width || !rect.height) {
        stop()
        return
      }

      const g = solver.geometry
      solver.resize(rect.width, rect.height)

      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(g.width * dpr)
      canvas.height = Math.round(g.height * dpr)
      canvas.style.width = `${g.width}px`
      canvas.style.height = `${g.height}px`

      wrap.style.setProperty('--card-w', `${g.cardW}px`)
      wrap.style.setProperty('--card-h', `${g.cardH}px`)
      wrap.style.setProperty('--rest-top', `${g.restTop}px`)

      readBrand()
      paint()
      applyCard()
      if (!reduced) start()
    }

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame)
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : FIXED_STEP
      lastTime = time
      accumulator = Math.min(accumulator + delta, 0.2)

      readBrand()
      while (accumulator >= FIXED_STEP) {
        solver.step(FIXED_STEP)
        accumulator -= FIXED_STEP
      }

      paint()
      applyCard()

      /*
       * 停下来就真的停：绳子和卡片都不动了还每帧重绘，等于给一屏静态画面
       * 付全程帧预算。这也是这一页「一屏只留一个常驻动效」说法的另一半 ——
       * 极光在动，工牌就只是挂着。
       */
      if (solver.isSettled()) stop()
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

    card.addEventListener('pointerdown', onPointerDown)

    /*
     * 主题切换要重画带子。静止时循环是停掉的（见 frame 末尾），
     * 不在这里补一次，切到浅色后带子会一直是深色主题的品牌色。
     */
    const themeWatch = new MutationObserver(() => {
      readBrand()
      paint()
    })
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

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
      stopListening()
      themeWatch.disconnect()
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      card.removeEventListener('pointerdown', onPointerDown)
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
