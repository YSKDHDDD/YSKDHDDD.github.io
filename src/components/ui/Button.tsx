import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

/**
 * 只保留四种变体，且全部使用语义色。
 * 不加 hover:scale —— 位移会让按钮"跳"，而这里需要的是"确认可点"。
 */
const variants = {
  primary: 'bg-brand text-white hover:bg-brand/90',
  outline: 'border border-line-strong text-fg hover:bg-surface-2',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  link: 'text-fg underline decoration-line-strong underline-offset-4 hover:decoration-brand px-0 h-auto',
}

const sizes = {
  sm: 'h-8 px-3 text-meta rounded-sm',
  md: 'h-10 px-4 text-meta rounded-sm',
  lg: 'h-12 px-6 text-body rounded-md',
  icon: 'h-9 w-9 rounded-sm',
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
        'transition-colors duration-[var(--motion-fast)] ease-soft',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
)

Button.displayName = 'Button'

export { Button }
