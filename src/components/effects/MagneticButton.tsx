import { useRef, type PointerEvent, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import './MagneticButton.css'

export interface MagneticButtonProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  /** 跟随强度：0 完全不动，1 完全跟着指针走。0.34 左右"能感觉到，但抓不住" */
  strength?: number
}

/**
 * 磁吸按钮：指针在按钮的感应范围内时，按钮向指针方向偏移。
 *
 * 感应范围比按钮本身大一圈（靠 .magnetic 的 padding），这才是"磁"的来源 ——
 * 如果只在按钮内部响应，那叫跟随，不叫磁吸。
 * 位移量是"指针到中心距离 × strength"，所以越靠边缘拉力越大，松手回弹。
 */
export default function MagneticButton({
  children,
  className,
  onClick,
  strength = 0.34,
}: MagneticButtonProps) {
  const zoneRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = zoneRef.current
    if (!el || reduced) return

    const rect = el.getBoundingClientRect()
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)

    el.style.setProperty('--mag-x', `${dx * strength}px`)
    el.style.setProperty('--mag-y', `${dy * strength}px`)
  }

  const handleLeave = () => {
    const el = zoneRef.current
    if (!el) return
    el.style.setProperty('--mag-x', '0px')
    el.style.setProperty('--mag-y', '0px')
  }

  return (
    <div
      ref={zoneRef}
      className="magnetic"
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <button type="button" className={cn('magnetic__button', className)} onClick={onClick}>
        {children}
      </button>
    </div>
  )
}
