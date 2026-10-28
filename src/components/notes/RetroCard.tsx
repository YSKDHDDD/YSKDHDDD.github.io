import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { Entry, RetroMeta } from '@/lib/content'
import { topicLabels } from '@/lib/content'
import { cn } from '@/lib/utils'

/** 复盘卡：突出"周期 + 一个能说明结果的变化"，而不是封面图 */
export function RetroCard({ retro, className }: { retro: Entry<RetroMeta>; className?: string }) {
  const { slug, meta } = retro
  const headline = meta.metrics?.[0]

  return (
    <Link
      to={`/retro/${slug}`}
      className={cn(
        'group flex flex-col justify-between gap-6 rounded-md border border-line bg-surface/50 p-5',
        'transition-colors duration-[var(--motion-fast)] ease-soft hover:border-line-strong',
        className,
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-label tracking-[0.04em] text-faint">{meta.period}</span>
          <ArrowUpRight
            className="h-4 w-4 text-faint opacity-0 transition-opacity duration-[var(--motion-fast)] group-hover:opacity-100"
            aria-hidden
          />
        </div>
        <h3 className="mt-2 text-h3 font-medium tracking-[-0.011em] text-fg">{meta.title}</h3>
        <p className="mt-2 line-clamp-2 text-meta text-muted">{meta.summary}</p>
      </div>

      <div className="flex items-end justify-between gap-3">
        {headline ? (
          <div>
            <div className="text-label text-faint">{headline.label}</div>
            <div className="mt-1 flex items-baseline gap-1.5 font-mono text-meta">
              <span className="text-faint line-through decoration-faint/50">{headline.before}</span>
              <span className="text-faint">→</span>
              <span className="text-fg">{headline.after}</span>
            </div>
          </div>
        ) : null}
        <span className="text-label text-faint">{topicLabels[meta.topic]}</span>
      </div>
    </Link>
  )
}
