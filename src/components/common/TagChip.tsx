import { cn } from '@/lib/utils'

interface TagChipProps {
  children: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export function TagChip({ children, active, onClick, className }: TagChipProps) {
  const shared =
    'inline-flex h-7 items-center rounded-full border px-2.5 font-mono text-label tracking-[0.02em] transition-colors duration-[var(--motion-fast)] ease-soft'

  if (!onClick) {
    return (
      <span className={cn(shared, 'border-line text-faint', className)}>#{children}</span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        shared,
        active
          ? 'border-brand/45 bg-brand-soft text-brand'
          : 'border-line text-muted hover:border-line-strong hover:text-fg',
        className,
      )}
    >
      #{children}
    </button>
  )
}
