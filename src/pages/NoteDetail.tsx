import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { mdxComponents } from '@/components/mdx/registry'
import { ReadingProgress } from '@/components/notes/ReadingProgress'
import { Toc } from '@/components/notes/Toc'
import { StatusDot } from '@/components/common/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { TagChip } from '@/components/common/TagChip'
import {
  formatDate,
  getNote,
  noteContent,
  getNoteNeighbours,
  statusHints,
  topicLabels,
} from '@/lib/content'

export default function NoteDetail() {
  const { slug = '' } = useParams()
  const note = getNote(slug)
  const Content = noteContent[slug]

  if (!note || !Content) {
    return (
      <div className="page-shell py-24 text-center">
        <p className="font-mono text-label text-faint">404</p>
        <h1 className="mt-3 text-h2 text-fg">这篇笔记不存在</h1>
        <Link to="/notes" className="mt-6 inline-block text-meta text-muted hover:text-fg">
          ← 回到笔记库
        </Link>
      </div>
    )
  }

  const { meta, toc, readingTime } = note
  const { newer, older } = getNoteNeighbours(slug)

  return (
    <>
      <ReadingProgress />

      <div className="page-shell py-10 sm:py-14">
        <Link
          to="/notes"
          className="group inline-flex items-center gap-1.5 text-meta text-faint transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-[var(--motion-fast)] group-hover:-translate-x-0.5" aria-hidden />
          笔记库
        </Link>

        <header className="mt-8 max-w-[680px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-label text-faint">
            <span>{topicLabels[meta.topic]}</span>
            <span aria-hidden>·</span>
            <time dateTime={meta.date}>{formatDate(meta.date)}</time>
            <span aria-hidden>·</span>
            <span>{readingTime} 分钟</span>
            <StatusDot status={meta.status} className="ml-1" />
          </div>

          <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">{meta.title}</h1>
          <p className="mt-4 text-body text-muted">{meta.summary}</p>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {meta.tags.map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </div>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[130px_minmax(0,680px)_104px] lg:justify-between">
          <Toc items={toc} />

          <article className="prose-note min-w-0">
            <Suspense
              fallback={<div className="h-40 animate-pulse rounded-sm bg-surface-2" aria-busy="true" />}
            >
              <Content components={mdxComponents} />
            </Suspense>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-5 text-label">
              <div>
                <div className="text-faint">成熟度</div>
                <StatusDot status={meta.status} className="mt-1.5" />
                <p className="mt-1 leading-relaxed text-faint">{statusHints[meta.status]}</p>
              </div>
              <div>
                <div className="text-faint">更新</div>
                <p className="mt-1 font-mono text-meta text-fg">{formatDate(meta.updated)}</p>
              </div>
              <div>
                <div className="text-faint">篇幅</div>
                <p className="mt-1 font-mono text-meta text-fg">
                  {readingTime} 分钟
                </p>
              </div>
              <div className="border-t border-line pt-3">
                <Badge tone="neutral">MDX</Badge>
              </div>
            </div>
          </aside>
        </div>

        <nav className="mt-16 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
          {older ? (
            <Link to={`/notes/${older.slug}`} className="group bg-bg p-4 transition-colors hover:bg-surface">
              <span className="flex items-center gap-1 text-label text-faint">
                <ArrowLeft className="h-3 w-3" aria-hidden /> 更早
              </span>
              <span className="mt-1.5 block text-meta text-fg">{older.meta.title}</span>
            </Link>
          ) : (
            <div className="bg-bg p-4" />
          )}
          {newer ? (
            <Link
              to={`/notes/${newer.slug}`}
              className="group bg-bg p-4 text-right transition-colors hover:bg-surface"
            >
              <span className="flex items-center justify-end gap-1 text-label text-faint">
                更新 <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
              <span className="mt-1.5 block text-meta text-fg">{newer.meta.title}</span>
            </Link>
          ) : (
            <div className="bg-bg p-4" />
          )}
        </nav>
      </div>
    </>
  )
}
