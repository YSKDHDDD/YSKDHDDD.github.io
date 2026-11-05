import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import './ScrollBackdrop.css'

/**
 * 滚动驱动的背景序列（scroll-driven backdrop sequence）。
 *
 * 结构上是「一条长轨道 + 一个吸顶舞台」：轨道有多长就决定这个效果能滚多久，
 * 舞台始终停在视口里，只换里面那一层图。和视差的区别是视差让**内容**分层移动，
 * 这里内容是正常滚动的，动的只有背景。
 *
 * 为什么不是"淡入淡出轮播"：三层背景由同一个进度 t 派生，相邻两层的透明度在
 * 交接区间里互补（A 降多少，B 就升多少），所以不存在"切换"这个动作 ——
 * 上一张是被下一张**接过去**的，不是被换掉的。
 *
 * 三条性能约束（改的时候别绕）：
 *
 * 1. 每帧只写 `opacity` 与 `transform`，两者都在合成器上跑。
 *    `split` 模式会用 clip-path 做斜切，那是会触发重绘的 —— 所以只在
 *    0 < opacity < 1 的过渡区间里写，静止帧一律置 `none`，成本被限制在交接的那一小段。
 * 2. 滚动进度不直接读 `scrollY`，而是读轨道 `getBoundingClientRect().top`。
 *    这样组件嵌在页面任何位置都成立，也不受 `scroll-margin` 之类的影响。
 * 3. 滚轮是离散事件，直接映射会让画面一顿一顿。`smoothing` 做指数衰减追帧，
 *    松开滚轮后画面还在往目标值收敛 —— 衔接感有一半来自这里。
 */

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1)
  return t * t * (3 - 2 * t)
}

export interface BackdropLayer {
  src: string
  /** 纯装饰的图留空，`alt=""` 会被读屏跳过，不额外挂 aria-hidden */
  alt?: string
}

export interface ScrollBackdropProps {
  layers: BackdropLayer[]
  /** 每层占几屏滚动距离。总高 = 层数 × 这个值 */
  screensPerLayer?: number
  /**
   * 满不透明态的停留比例（0–0.9）。
   * 0 = 三角波，全程都在过渡；0.3 = 每层到位后稳一下再交出去。
   */
  hold?: number
  /** 层间位移差：相邻两层在交接时的上下错位量（px）。0 = 完全不动 */
  parallax?: number
  /** 斜切力度（百分比）。0 = 纯交叉淡入；48 = 退场层对角线最多切掉 48% */
  split?: number
  /** 进度平滑系数，数值越大越跟手，0 = 直接跟手 */
  smoothing?: number
  /** 压暗遮罩的强度 0–1，保证压在图上的字有对比度 */
  scrim?: number
  /**
   * 交接时额外压暗的量。两张高细节的照片各占一半时最"花"，
   * 在过渡中点多压 0.18 能让衔接看起来是有意为之，也让白字始终读得清。
   */
  scrimDip?: number
  className?: string
  children?: ReactNode
}

const ScrollBackdrop = ({
  layers,
  screensPerLayer = 1,
  hold = 0.3,
  parallax = 48,
  split = 0,
  smoothing = 0.09,
  scrim = 0.55,
  scrimDip = 0.18,
  className = '',
  children,
}: ScrollBackdropProps) => {
  const rootRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const scrimRef = useRef<HTMLDivElement | null>(null)
  const layerRefs = useRef<(HTMLImageElement | null)[]>([])
  const reduced = usePrefersReducedMotion()

  /*
   * latest-ref：参数在渲染阶段写进 ref，逐帧读取时就不会读到闭包里的旧值。
   * 断点切换时 parallax / split 会变，但给组件换参数不该重启滚动监听。
   */
  const configRef = useRef({ count: layers.length, hold, parallax, split, smoothing, scrim, scrimDip })
  useLayoutEffect(() => {
    configRef.current = { count: layers.length, hold, parallax, split, smoothing, scrim, scrimDip }
  })

  const applyProgress = useCallback((progress: number) => {
    const {
      count,
      hold: holdRatio,
      parallax: shift,
      split: cut,
      scrim: scrimBase,
      scrimDip: dip,
    } = configRef.current
    if (count === 0) return

    /* 层空间坐标：3 层时 u ∈ [0, 2]，整数位置即某一层刚好满不透明 */
    const u = count === 1 ? 0 : progress * (count - 1)
    const edge = Math.min(0.45, holdRatio / 2)
    /* 交接强度：某层正好 0.5 时最强，两端为 0。用来给遮罩加一点"过渡时更暗" */
    let mix = 0

    for (let i = 0; i < count; i += 1) {
      const el = layerRefs.current[i]
      if (!el) continue

      /*
       * 透明度不能做成「每层各占一块三角波」。
       *
       * 这些图是同一个位置上的兄弟节点，后画的压住先画的：如果 A 淡到 0.3、
       * B 淡到 0.7，屏幕上不是 3:7 的混合，而是 B 以 0.7 压在一层只剩 0.3 的 A 上 ——
       * 两张都变暗，越往下滚越黑。所以只有**上层往下淡入**，下层始终是满的：
       * 合成结果才是真正的 a·B + (1−a)·A。
       *
       * 于是每层的透明度只在自己那一段里从 0 走到 1，走完就不动了；
       * 第 0 层是底图，永远满不透明。
       */
      const opacity = i === 0 ? 1 : smoothstep(i - 1 + edge, i - edge, u)
      const delta = u - i

      el.style.opacity = opacity.toFixed(3)
      el.style.transform = `translate3d(0, ${(delta * shift).toFixed(2)}px, 0) scale(${(
        1 + Math.min(0.08, Math.abs(delta) * 0.06)
      ).toFixed(4)})`

      if (cut > 0) {
        /*
         * 只有正在过渡的那一层被斜着切 —— 它一定是压在下层之上的那一层，
         * 切掉的部分露出下一张图，两张拼在一起才是「碎片重组」。
         * 全不透明和全透明两端都置 none：静止帧不该为 clip-path 付重绘。
         */
        if (opacity > 0.002 && opacity < 0.998) {
          const percent = ((1 - opacity) * cut).toFixed(2)
          el.style.clipPath =
            i % 2 === 0
              ? `polygon(0 ${percent}%, 100% 0, 100% 100%, 0 100%)`
              : `polygon(0 0, 100% ${percent}%, 100% 100%, 0 100%)`
        } else {
          el.style.clipPath = 'none'
        }
      } else if (el.style.clipPath) {
        /* 运行时把 split 关掉（比如窄屏退化成纯淡入）时，别把上一帧的斜切留在元素上 */
        el.style.clipPath = 'none'
      }

      if (i > 0) mix = Math.max(mix, opacity * (1 - opacity) * 4)
    }

    /*
     * 交界处再多压一点暗。这不是"氛围"，是补救：
     * 两张高细节照片各占一半时画面最花，读起来像信号串扰；压低一点反而像一次转场。
     * 顺带把白字的对比度兜住 —— 否则文字能不能读全看下一张图是什么颜色。
     */
    if (scrimRef.current) {
      scrimRef.current.style.opacity = (scrimBase + dip * mix).toFixed(3)
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return

    /* 减少动效：停在第一帧，滚动距离与版面高度都不变，只是不再有变化 */
    if (reduced) {
      applyProgress(0)
      return
    }

    let raf = 0
    let current = 0
    let target = 0
    let spanPx = 1
    let running = false

    const measure = () => {
      spanPx = Math.max(1, root.offsetHeight - stage.offsetHeight)
    }

    const readProgress = () => {
      const rect = root.getBoundingClientRect()
      return clamp(-rect.top / spanPx, 0, 1)
    }

    const tick = () => {
      const k = configRef.current.smoothing <= 0
        ? 1
        : 1 - Math.exp(-1 / (60 * configRef.current.smoothing))
      current += (target - current) * k
      if (Math.abs(target - current) < 0.0004) {
        current = target
        running = false
      }
      applyProgress(current)
      raf = running ? requestAnimationFrame(tick) : 0
    }

    const kick = () => {
      if (running) return
      running = true
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      target = readProgress()
      if (configRef.current.smoothing <= 0) {
        current = target
        applyProgress(current)
        return
      }
      kick()
    }

    const onResize = () => {
      measure()
      target = readProgress()
      current = target
      applyProgress(current)
    }

    measure()
    target = readProgress()
    current = target
    applyProgress(current)

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    const observer = new ResizeObserver(onResize)
    observer.observe(root)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
    }
  }, [applyProgress, reduced])

  return (
    <section
      ref={rootRef}
      className={`scroll-backdrop ${split > 0 ? 'scroll-backdrop--split' : ''} ${className}`.trim()}
      style={
        {
          '--sb-layers': String(Math.max(1, layers.length)),
          '--sb-screens': String(Math.max(1, screensPerLayer)),
          '--sb-scrim': scrim,
        } as CSSProperties
      }
      aria-roledescription="滚动背景序列"
    >
      <div ref={stageRef} className="scroll-backdrop__stage">
        {layers.map((layer, index) => (
          <img
            key={layer.src}
            ref={(el) => {
              layerRefs.current[index] = el
            }}
            className="scroll-backdrop__layer"
            src={layer.src}
            alt={layer.alt ?? ''}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ))}
        <div ref={scrimRef} className="scroll-backdrop__scrim" aria-hidden />
        {children ? <div className="scroll-backdrop__overlay">{children}</div> : null}
      </div>
    </section>
  )
}

export default ScrollBackdrop
