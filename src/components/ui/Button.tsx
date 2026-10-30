import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  /**
   * 放进 <Link> / <a> 里时必须传 `span`。
   * HTML 不允许 <a> 包含可交互内容：套 button 会让键盘用户按两次 Tab 才过一个按钮，
   * 屏幕阅读器也会把同一处念两遍（「链接 浏览笔记」「按钮 浏览笔记」）。
   */
  as?: 'button' | 'span'
}

/**
 * 只保留四种变体，且全部使用语义色。
 * 不加 hover:scale —— 位移会让按钮"跳"，而这里需要的是"确认可点"。
 */
const variants = {
  primary: 'btn-brand hover:brightness-110',
  outline: 'border border-line-strong text-fg hover:border-brand/45 hover:bg-surface-2',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  link: 'text-fg underline decoration-line-strong underline-offset-4 hover:decoration-brand px-0 h-auto',
}

const sizes = {
  sm: 'h-8 px-3 text-meta rounded-sm',
  md: 'h-10 px-4 text-meta rounded-sm',
  lg: 'h-12 px-6 text-body rounded-md',
  icon: 'h-9 w-9 rounded-sm',
}

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ' +
  'transition-colors duration-[var(--motion-fast)] ease-soft ' +
  'disabled:pointer-events-none disabled:opacity-40'

const Button = React.forwardRef<HTMLElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', as = 'button', ...props }, ref) => {
    if (as === 'span') {
      return (
        <span
          ref={ref as React.Ref<HTMLSpanElement>}
          className={cn(base, variants[variant], sizes[size], className)}
          {...(props as React.HTMLAttributes<HTMLSpanElement>)}
        />
      )
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'

export { Button }
