import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Entry, NoteMeta } from '@/lib/content'
import { formatDate, topicLabels } from '@/lib/content'
import { topicTone } from '@/lib/tone'
import { StatusDot } from '@/components/common/StatusDot'
import { cn } from '@/lib/utils'

/**
 * 笔记行：日期 / 标题 + 摘要 / 领域 + 时长。
 * 不做卡片——卡片牺牲密度，200 篇之后就没法用了。
 *
 * 领域那一格带色：列表里靠颜色就能分出"工程 / 设计 / 工具链"，
 * 不必逐行读字。左侧那道竖线是同一个色相的放大版，只在悬停时出现。
 */
export function NoteRow({
  note,
  className,
  href,
  local,
}: {
  note: Entry<NoteMeta>
  className?: string
  /** 本地文档读自己的地址；站内笔记走默认的 /notes/:slug */
  href?: string
  /** 标记"这篇只在这台设备上"，否则用户在别的设备上点开会是 404 */
  local?: boolean
}) {
  const { slug, meta, readingTime } = note
  const tone = topicTone[meta.topic]

  return (
    <Link
      to={href ?? `/notes/${slug}`}
      className={cn(
        'group relative flex gap-4 border-b border-line py-4 pl-2.5 pr-2',
        'transition-[transform,background-color] duration-[var(--motion-fast)] ease-soft',
        'hover:translate-x-0.5 hover:bg-surface-2/40',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute top-3 bottom-3 left-0 w-[2px] origin-center scale-y-0 rounded-full transition-transform duration-[var(--motion-fast)] ease-soft group-hover:scale-y-100"
        style={{ backgroundColor: tone }}
      />

      <time
        dateTime={meta.date}
        className="mt-1 w-20 shrink-0 font-mono text-label text-faint tabular-nums"
      >
        {formatDate(meta.date)}
      </time>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-body font-medium text-fg">{meta.title}</h3>
          {local ? (
            <span className="shrink-0 rounded-full border border-brand-2/35 px-1.5 py-px font-mono text-[10px] leading-tight text-brand-2">
              本地
            </span>
          ) : null}
          <StatusDot status={meta.status} className="relative top-[-1px] shrink-0" />
        </div>
        <p className="mt-1 truncate text-meta text-faint">{meta.summary}</p>
      </div>

      <div className="mt-1 hidden shrink-0 items-center gap-3 text-label text-faint sm:flex">
        <span style={{ color: tone }}>{topicLabels[meta.topic]}</span>
        <span className="tabular-nums">{readingTime} 分钟</span>
        <ArrowUpRight
          className="h-3.5 w-3.5 opacity-0 transition-opacity duration-[var(--motion-fast)] group-hover:opacity-100"
          aria-hidden
        />
      </div>
    </Link>
  )
}
