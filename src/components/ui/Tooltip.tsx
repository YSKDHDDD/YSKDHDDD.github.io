import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  /** 提示内容 */
  content: React.ReactNode
  /** 弹出方向，默认 top */
  side?: TooltipSide
  /** 悬停多少毫秒后显示 */
  delay?: number
  /** 提示框的自定义类名 */
  className?: string
  /** 触发元素，建议放一个 button */
  children: React.ReactNode
}

const GAP = 8

/**
 * 悬停/聚焦显示的轻量 Tooltip。
 * 通过 portal 渲染到 body，避免被父级 overflow:hidden 裁掉。
 */
export function Tooltip({ content, side = 'top', delay = 150, className, children }: TooltipProps) {
  const [open, setOpen] = React.useState(false)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)
  const triggerRef = React.useRef<HTMLSpanElement>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const updatePosition = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const next = {
      top: side === 'top' ? rect.top - GAP : side === 'bottom' ? rect.bottom + GAP : centerY,
      left: side === 'left' ? rect.left - GAP : side === 'right' ? rect.right + GAP : centerX,
    }
    setCoords(next)
  }, [side])

  const show = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      updatePosition()
      setOpen(true)
    }, delay)
  }

  const hide = () => {
    clearTimeout(timerRef.current)
    setOpen(false)
  }

  React.useEffect(() => () => clearTimeout(timerRef.current), [])

  // 打开时跟随滚动/缩放同步位置
  React.useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  const transform = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  }[side]

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>

      {open &&
        coords &&
        createPortal(
          <div
            role="tooltip"
            data-side={side}
            style={{ top: coords.top, left: coords.left, transform }}
            className={cn(
              'pointer-events-none fixed z-[10001] max-w-xs rounded-lg border border-white/10',
              'bg-slate-900/95 px-3 py-2 text-sm font-medium text-white shadow-2xl backdrop-blur-xl',
              'animate-fade-in',
              className
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  )
}
