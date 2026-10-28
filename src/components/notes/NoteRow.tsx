import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Entry, NoteMeta } from '@/lib/content'
import { formatDate, topicLabels } from '@/lib/content'
import { StatusDot } from '@/components/common/StatusDot'
import { cn } from '@/lib/utils'

/**
 * 笔记行：日期 / 标题 + 摘要 / 领域 + 时长。
 * 不做卡片——卡片牺牲密度，200 篇之后就没法用了。
 */
export function NoteRow({ note, className }: { note: Entry<NoteMeta>; className?: string }) {
  const { slug, meta, readingTime } = note

  return (
    <Link
      to={`/notes/${slug}`}
      className={cn(
        'group relative flex gap-4 border-b border-line py-4 pl-0 pr-2',
        'transition-[transform,background-color] duration-[var(--motion-fast)] ease-soft',
        'hover:translate-x-0.5 hover:bg-surface-2/40',
        className,
      )}
    >
      <time
        dateTime={meta.date}
        className="mt-1 w-20 shrink-0 font-mono text-label text-faint tabular-nums"
      >
        {formatDate(meta.date)}
      </time>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-body font-medium text-fg">{meta.title}</h3>
          <StatusDot status={meta.status} className="relative top-[-1px] shrink-0" />
        </div>
        <p className="mt-1 truncate text-meta text-faint">{meta.summary}</p>
      </div>

      <div className="mt-1 hidden shrink-0 items-center gap-3 text-label text-faint sm:flex">
        <span>{topicLabels[meta.topic]}</span>
        <span className="tabular-nums">{readingTime} 分钟</span>
        <ArrowUpRight
          className="h-3.5 w-3.5 opacity-0 transition-opacity duration-[var(--motion-fast)] group-hover:opacity-100"
          aria-hidden
        />
      </div>
    </Link>
  )
}
