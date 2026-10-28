import { useRef, type PointerEvent, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import './TiltCard.css'

export interface TiltCardProps {
  children: ReactNode
  className?: string
  /** 最大倾斜角度（度）。默认 9 度，再大就开始像廉价 PPT 转场了 */
  max?: number
}

/**
 * 指针驱动的 3D 倾斜。
 *
 * 两个实现细节值得说明：
 * 1. 位移写进 CSS 自定义属性、直接改 style，不走 setState —— 每帧一次重渲染
 *    在低端机上会把 pointermove 拖成掉帧。
 * 2. 进入时过渡长（回弹柔和）、悬停时过渡短（跟手）。CSS 用一个 :hover 覆盖
 *    transition-duration 就能区分这两个阶段，不需要 JS 记状态。
 */
export default function TiltCard({ children, className, max = 9 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || reduced) return

    const rect = el.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    el.style.setProperty('--tilt-rx', `${(0.5 - y) * max * 2}deg`)
    el.style.setProperty('--tilt-ry', `${(x - 0.5) * max * 2}deg`)
    el.style.setProperty('--tilt-gx', `${x * 100}%`)
    el.style.setProperty('--tilt-gy', `${y * 100}%`)
  }

  const handleLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--tilt-rx', '0deg')
    el.style.setProperty('--tilt-ry', '0deg')
  }

  return (
    <div
      ref={ref}
      className={cn('tilt-card', className)}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <div className="tilt-card__inner">
        {children}
        <span className="tilt-card__glare" aria-hidden />
      </div>
    </div>
  )
}
