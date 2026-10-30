import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ArchiveTimeline } from '@/components/notes/ArchiveTimeline'
import { PageWash } from '@/components/common/PageWash'
import { useEntryRows, type EntryRow } from '@/hooks/useEntryRows'
import { formatDate } from '@/lib/content'

/**
 * 归档页：唯一一条按时间而不是按分类读的路径。
 *
 * 笔记库回答"我关心哪些主题"，这一页回答"我什么时候在写字"。
 * 中间断掉的几个月不会被补平 —— 空白本身是这套外脑最诚实的字段。
 */
/** 统计行：条数、年份数、时间跨度，全部从数据现算，不写死 */
function statsOf(rows: EntryRow[]) {
  const years = new Set(rows.map((row) => row.meta.date.slice(0, 4)))
  return {
    total: rows.length,
    years: years.size,
    oldest: rows[rows.length - 1]?.meta.date ?? '',
  }
}

export default function Archive() {
  const rows = useEntryRows({ withRetros: true })
  const stats = statsOf(rows)

  return (
    <div className="page-shell py-12 sm:py-16">
      <PageWash tone="notes" />

      <Link
        to="/notes"
        className="group inline-flex items-center gap-1.5 text-meta text-faint transition-colors hover:text-fg"
      >
        <ArrowLeft
          className="h-3.5 w-3.5 transition-transform duration-[var(--motion-fast)] group-hover:-translate-x-0.5"
          aria-hidden
        />
        笔记库
      </Link>

      <header className="mt-8 max-w-[52ch]">
        <p className="font-mono text-label tracking-[0.14em] text-brand-2">ARCHIVE</p>
        <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">归档</h1>
        <p className="mt-3 text-body text-muted">
          不按主题，只按时间 —— 笔记和复盘都在这里。主题说明我在关心什么，时间才说明我在不在。
        </p>
        {stats.total > 0 ? (
          <p className="mt-2 font-mono text-label text-faint">
            {stats.total} 条 · {stats.years} 年 · {formatDate(stats.oldest)} 起
          </p>
        ) : null}
      </header>

      {/*
        列宽按内容定，不铺满视口：铺满 1120 时标题这一列能到 830px，
        实际最长的一行只有 480px —— 多出来的空白会变成标题和标签之间的一段空洞。
        920px 刚好让标签贴住这一栏的右缘，又不用横跨半屏去找它。
      */}
      {stats.total === 0 ? (
        <p className="mt-16 text-body text-muted">还没有内容可归档。</p>
      ) : (
        <div className="mt-10 max-w-[920px]">
          <ArchiveTimeline rows={rows} />
        </div>
      )}

      <p className="mt-12 max-w-[52ch] text-meta text-faint">
        想按主题或成熟度找，回
        <Link
          to="/notes"
          className="mx-1 text-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg"
        >
          笔记库
        </Link>
        ；这一页只管时间。
      </p>
    </div>
  )
}
