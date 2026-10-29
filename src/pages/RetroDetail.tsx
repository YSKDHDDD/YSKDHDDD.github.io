import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { mdxComponents } from '@/components/mdx/registry'
import { ReadingProgress } from '@/components/notes/ReadingProgress'
import { Toc } from '@/components/notes/Toc'
import { PageWash } from '@/components/common/PageWash'
import { Badge } from '@/components/ui/Badge'
import { RelatedReading } from '@/components/notes/RelatedReading'
import { formatDate, getRelatedEntries, getRetro, retroContent } from '@/lib/content'

export default function RetroDetail() {
  const { slug = '' } = useParams()
  const retro = getRetro(slug)
  const Content = retroContent[slug]

  if (!retro || !Content) {
    return (
      <div className="page-shell py-24 text-center">
        <p className="font-mono text-label text-faint">404</p>
        <h1 className="mt-3 text-h2 text-fg">这个复盘不存在</h1>
        <Link to="/retro" className="mt-6 inline-block text-meta text-muted hover:text-fg">
          ← 回到复盘列表
        </Link>
      </div>
    )
  }

  const { meta, toc } = retro
  const related = getRelatedEntries({
    href: `/retro/${slug}`,
    topic: meta.topic,
    tags: meta.tags,
  })

  return (
    <>
      <PageWash tone="retro" />
      <ReadingProgress />

      <div className="page-shell py-10 sm:py-14">
        <Link
          to="/retro"
          className="group inline-flex items-center gap-1.5 text-meta text-faint transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-[var(--motion-fast)] group-hover:-translate-x-0.5" aria-hidden />
          项目复盘
        </Link>

        <header className="mt-8 max-w-[720px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-label text-faint">
            <span>{meta.period}</span>
            <span aria-hidden>·</span>
            <span>{meta.role}</span>
            <span aria-hidden>·</span>
            <time dateTime={meta.date}>{formatDate(meta.date)}</time>
          </div>
          <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">{meta.title}</h1>
          <p className="mt-4 text-body text-muted">{meta.summary}</p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {meta.stack.map((item) => (
              <Badge key={item} tone="neutral">
                {item}
              </Badge>
            ))}
          </div>
        </header>

        {/* 结果表放在最前面：读者先看到结论，再决定要不要读过程 */}
        <section aria-label="结果" className="mt-10 overflow-hidden rounded-md border border-line">
          <div className="border-b border-line bg-surface/50 px-4 py-2 text-label tracking-[0.06em] text-faint">
            结果 · 前 → 后
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {meta.metrics.map((metric) => (
              <div key={metric.label} className="bg-bg px-4 py-3">
                <div className="text-label text-faint">{metric.label}</div>
                <div className="mt-1.5 flex items-baseline gap-1.5 font-mono text-meta">
                  <span className="text-faint line-through decoration-faint/50">{metric.before}</span>
                  <span className="text-faint">→</span>
                  <span className="text-fg">{metric.after}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 grid gap-10 lg:grid-cols-[130px_minmax(0,720px)] lg:justify-between">
          <Toc items={toc} />
          <article className="prose-note min-w-0">
            <Suspense
              fallback={<div className="h-40 animate-pulse rounded-sm bg-surface-2" aria-busy="true" />}
            >
              <Content components={mdxComponents} />
            </Suspense>
          </article>
        </div>

        <RelatedReading items={related} currentTags={meta.tags} />
      </div>
    </>
  )
}
