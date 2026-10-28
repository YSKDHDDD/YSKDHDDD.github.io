import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface TagChipProps {
  children: string
  active?: boolean
  onClick?: () => void
  /** 给了地址就渲染成链接：详情页的标签要能跳回筛好的笔记库 */
  to?: string
  className?: string
}

export function TagChip({ children, active, onClick, to, className }: TagChipProps) {
  const shared =
    'inline-flex h-7 items-center rounded-full border px-2.5 font-mono text-label tracking-[0.02em] transition-colors duration-[var(--motion-fast)] ease-soft'

  const states = active
    ? 'border-brand/45 bg-brand-soft text-brand'
    : 'border-line text-faint hover:border-line-strong hover:text-fg'

  if (to) {
    return (
      <Link to={to} className={cn(shared, states, className)}>
        #{children}
      </Link>
    )
  }

  if (!onClick) {
    return <span className={cn(shared, 'border-line text-faint', className)}>#{children}</span>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(shared, states, className)}
    >
      #{children}
    </button>
  )
}
