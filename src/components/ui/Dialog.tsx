import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  className?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 弹层：Esc 关闭、点遮罩关闭、打开时锁滚动、焦点进出自洽。
 * 样式只用语义令牌，深浅主题自动跟随。
 */
const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  ({ className, children, open = false, onOpenChange }, ref) => {
    const contentRef = React.useRef<HTMLDivElement | null>(null)

    React.useEffect(() => {
      if (!open) return

      const previousFocus = document.activeElement as HTMLElement | null
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onOpenChange?.(false)
          return
        }
        if (event.key !== 'Tab') return

        const nodes = contentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
        if (!nodes || nodes.length === 0) return

        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      // 首帧之后再聚焦，避免与打开动画抢帧
      const raf = requestAnimationFrame(() => {
        contentRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
      })

      return () => {
        document.body.style.overflow = previousOverflow
        document.removeEventListener('keydown', handleKeyDown)
        cancelAnimationFrame(raf)
        previousFocus?.focus()
      }
    }, [open, onOpenChange])

    if (!open) return null

    return createPortal(
      <div
        className={cn('fixed inset-0 z-[900] flex items-start justify-center p-4 pt-[12vh]', className)}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="absolute inset-0 bg-bg/70 backdrop-blur-[6px]"
          onClick={() => onOpenChange?.(false)}
        />
        <div
          ref={(node) => {
            contentRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          className="relative z-10 w-full max-w-xl overflow-hidden rounded-md border border-line-strong bg-surface shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)]"
        >
          {children}
        </div>
      </div>,
      document.body,
    )
  },
)
Dialog.displayName = 'Dialog'

const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 px-4 pt-4', className)} {...props} />
  ),
)
DialogHeader.displayName = 'DialogHeader'

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-h3 font-medium text-fg', className)} {...props} />
  ),
)
DialogTitle.displayName = 'DialogTitle'

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-4', className)} {...props} />,
)
DialogContent.displayName = 'DialogContent'

const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-end gap-2 border-t border-line px-4 py-3', className)}
      {...props}
    />
  ),
)
DialogFooter.displayName = 'DialogFooter'

const DialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label="关闭"
    className={cn(
      'absolute top-3 right-3 rounded-sm p-1.5 text-faint transition-colors duration-[var(--motion-fast)]',
      'hover:bg-surface-2 hover:text-fg',
      className,
    )}
    {...props}
  >
    <X className="h-4 w-4" />
  </button>
))
DialogClose.displayName = 'DialogClose'

export { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, DialogClose }
