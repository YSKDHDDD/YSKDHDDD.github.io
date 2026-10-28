import type { ReactNode } from 'react'
import { CircleDot, GitBranch, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

type CalloutType = 'decision' | 'warn' | 'unverified'

const config: Record<
  CalloutType,
  { label: string; className: string; labelClass: string; Icon: typeof CircleDot }
> = {
  decision: {
    label: '决策',
    className: 'border-decision/40 bg-decision/[0.06]',
    labelClass: 'text-decision',
    Icon: GitBranch,
  },
  warn: {
    label: '注意',
    className: 'border-warn/40 bg-warn/[0.06]',
    labelClass: 'text-warn',
    Icon: ShieldAlert,
  },
  unverified: {
    label: '待验证',
    className: 'border-unverified/40 bg-unverified/[0.06]',
    labelClass: 'text-unverified',
    Icon: CircleDot,
  },
}

/**
 * 三种 Callout。其中「待验证」是我最想要的一个——
 * 敢在正文里标出"这条我还没验证"，比任何自我描述都可信。
 */
export function Callout({
  type = 'decision',
  title,
  children,
}: {
  type?: CalloutType
  title?: string
  children: ReactNode
}) {
  const { label, className, labelClass, Icon } = config[type]

  return (
    <aside className={cn('my-7 rounded-sm border-l-2 py-3 pr-4 pl-4', className)}>
      <div className={cn('mb-1 flex items-center gap-1.5 text-label font-medium', labelClass)}>
        <Icon className="h-3 w-3" aria-hidden />
        <span>{title ?? label}</span>
        {title ? <span className="text-faint">· {label}</span> : null}
      </div>
      <div className="text-meta leading-relaxed text-muted [&>p]:m-0 [&>p+p]:mt-2">
        {children}
      </div>
    </aside>
  )
}

export interface DecisionOption {
  label: string
  note?: string
}

/** 复盘页的原创排版元素：选项并列 → 选了什么 → 为什么 → 代价 */
export function DecisionCard({
  index,
  title,
  options,
  chosen,
  reason,
  cost,
}: {
  index: string
  title: string
  options: DecisionOption[]
  chosen: string
  reason: string
  cost?: string
}) {
  return (
    <section className="my-7 rounded-md border border-line bg-surface/50">
      <header className="flex items-baseline gap-3 border-b border-line px-4 py-3">
        <span className="font-mono text-label text-faint">{index}</span>
        <h4 className="text-body font-medium text-fg">{title}</h4>
      </header>

      <div className="grid gap-2 px-4 py-4 sm:grid-cols-2">
        {options.map((option) => {
          const isChosen = option.label === chosen
          return (
            <div
              key={option.label}
              className={cn(
                'rounded-sm border px-3 py-2.5',
                isChosen ? 'border-brand/45 bg-brand-soft' : 'border-line bg-bg/40',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-meta font-medium', isChosen ? 'text-brand' : 'text-muted')}>
                  {option.label}
                </span>
                {isChosen ? (
                  <span className="text-label text-brand">选中</span>
                ) : null}
              </div>
              {option.note ? (
                <p className="mt-1 text-label leading-relaxed text-faint">{option.note}</p>
              ) : null}
            </div>
          )
        })}
      </div>

      <dl className="space-y-2 border-t border-line px-4 py-3 text-meta">
        <div className="flex gap-3">
          <dt className="w-12 shrink-0 text-faint">理由</dt>
          <dd className="text-muted">{reason}</dd>
        </div>
        {cost ? (
          <div className="flex gap-3">
            <dt className="w-12 shrink-0 text-faint">代价</dt>
            <dd className="text-muted">{cost}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
