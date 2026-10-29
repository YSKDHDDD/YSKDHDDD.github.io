import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  index: string
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}

/** 01 / 02 编号不是装饰：它给首页一个可数的节奏，让读者知道还剩几段 */
export function SectionHeading({ index, title, hint, action, className }: SectionHeadingProps) {
  return (
    <div className={cn('relative flex items-end justify-between gap-6 pb-3', className)}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-label tracking-[0.08em] text-brand-2">{index}</span>
        <h2 className="text-h2 font-medium tracking-[-0.011em] text-fg">{title}</h2>
        {hint ? <span className="hidden text-meta text-faint sm:inline">{hint}</span> : null}
      </div>
      {action ? <div className="shrink-0 text-meta">{action}</div> : null}
      <div aria-hidden className="rule-gradient absolute inset-x-0 bottom-0" />
    </div>
  )
}
