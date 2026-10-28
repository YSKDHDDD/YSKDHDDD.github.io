import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import './GlowBorder.css'

export interface GlowBorderProps {
  children: ReactNode
  className?: string
  /** 一圈走完的秒数。越慢越"贵"，4–6 秒比较耐看 */
  duration?: number
}

/**
 * 流光边框：一个 conic-gradient 绕容器旋转，只露出 1px 的边。
 *
 * 关键的取舍是**不用 SVG 也不用 canvas** —— 边框是一维的，用 `@property --glow-angle`
 * 让角度变量可插值，动画就完全交给合成器，主线程零成本。
 * 光学上它模拟的是"光沿边缘扫过"，所以渐变里要有两段透明：
 * 一段让光有头、一段让尾巴拖出去，匀速旋转变成了有速度感的光。
 */
export default function GlowBorder({ children, className, duration = 4.5 }: GlowBorderProps) {
  return (
    <div
      className={cn('glow-border', className)}
      style={{ '--glow-duration': `${duration}s` } as CSSProperties}
    >
      <div className="glow-border__inner">{children}</div>
    </div>
  )
}
