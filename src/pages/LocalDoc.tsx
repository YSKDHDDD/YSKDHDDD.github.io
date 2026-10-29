import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, HardDrive, Trash2 } from 'lucide-react'
import { PageWash } from '@/components/common/PageWash'
import { ReadingProgress } from '@/components/notes/ReadingProgress'
import { Toc } from '@/components/notes/Toc'
import { TagChip } from '@/components/common/TagChip'
import { StatusDot } from '@/components/common/StatusDot'
import { useLocalDocs } from '@/hooks/useLocalDocs'
import { formatDate, topicLabels } from '@/lib/content'
import { deleteLocalDoc, formatBytes } from '@/lib/localDocs'
import { renderMarkdown, stripTitleHeading } from '@/lib/markdown'
import { topicTone } from '@/lib/tone'

/**
 * 本地文档的阅读页。
 *
 * 和站内笔记共用同一套排版（.prose-note）与三栏结构，但正文来自运行时渲染，
 * 不是构建期编译的 MDX —— 所以这里没有 Suspense，也没有 shiki 高亮。
 * 取舍很明确：导入的东西必须"立刻能读"，不为了一次高亮去背一个语言包。
 */
export default function LocalDocPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { docs, ready } = useLocalDocs()

  const doc = docs.find((item) => item.id === id)
  const rendered = useMemo(
    () => (doc ? renderMarkdown(stripTitleHeading(doc.body, doc.title)) : null),
    [doc],
  )

  if (!ready) {
    return (
      <div className="page-shell py-24">
        <div className="h-6 w-32 animate-pulse rounded-sm bg-surface-2" aria-busy="true" />
        <div className="mt-6 h-10 w-2/3 animate-pulse rounded-sm bg-surface-2" />
        <div className="mt-8 h-64 animate-pulse rounded-sm bg-surface-2" />
      </div>
    )
  }

  if (!doc || !rendered) {
    return (
      <div className="page-shell py-24 text-center">
        <p className="font-mono text-label text-faint">LOCAL · 404</p>
        <h1 className="mt-3 text-h2 text-fg">这篇本地文档不在这个浏览器里</h1>
        <p className="mx-auto mt-3 max-w-[42ch] text-meta text-muted">
          本地文档只存在导入时用的那台设备、那个浏览器里。换设备、换浏览器、或者清过站点数据，
          都会读不到——这也是"不上传"的代价。
        </p>
        <div className="mt-6 flex items-center justify-center gap-4 text-meta">
          <Link to="/import" className="text-brand-2 hover:underline">
            导入一篇
          </Link>
          <Link to="/notes" className="text-muted hover:text-fg">
            回到笔记库
          </Link>
        </div>
      </div>
    )
  }

  const exportDoc = () => {
    const blob = new Blob([doc.body], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${doc.title.replace(/[/\\?%*:|"<>]/g, '-')}.md`
    anchor.click()
    // 立刻 revoke 会让部分浏览器的下载拿到空文件，等一拍再释放
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <PageWash tone="notes" />
      <ReadingProgress />

      <div className="page-shell py-10 sm:py-14">
        <div className="flex items-center justify-between gap-4">
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

          <div className="flex items-center gap-3 text-label">
            <button
              type="button"
              onClick={exportDoc}
              className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-fg"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              导出 .md
            </button>
            <button
              type="button"
              onClick={() => {
                void deleteLocalDoc(doc.id).then(() => navigate('/import'))
              }}
              className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-warn"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              删除
            </button>
          </div>
        </div>

        <header className="mt-8 max-w-[680px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-label text-faint">
            <span style={{ color: topicTone[doc.topic] }}>{topicLabels[doc.topic]}</span>
            <span aria-hidden>·</span>
            <time dateTime={doc.date}>{formatDate(doc.date)}</time>
            <span aria-hidden>·</span>
            <span>{rendered.readingTime} 分钟</span>
            <StatusDot status={doc.status} className="ml-1" />
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-brand-2">
              <HardDrive className="h-3 w-3" aria-hidden />
              本地
            </span>
          </div>

          <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">{doc.title}</h1>
          <p className="mt-4 text-body text-muted">{doc.summary}</p>

          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            {doc.tags.map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
            <span className="ml-1 font-mono text-label text-faint">
              {doc.fileName} · {formatBytes(doc.size)} · 导入于 {formatDate(new Date(doc.importedAt).toISOString().slice(0, 10))}
            </span>
          </div>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[130px_minmax(0,680px)_104px] lg:justify-between">
          <Toc items={rendered.headings} />

          {/*
            dangerouslySetInnerHTML 在这里是安全的：html 由 renderMarkdown 生成，
            它对原文做过完整转义，输出的标签全部由渲染器自己拼接，
            不存在"用户原文里的 <script> 被当标签解析"的可能。
          */}
          <article className="prose-note min-w-0" dangerouslySetInnerHTML={{ __html: rendered.html }} />

          <aside className="hidden lg:block" aria-label="文档信息">
            <div className="sticky top-24 space-y-2 font-mono text-label text-faint">
              <p>{doc.fileName}</p>
              <p>{formatBytes(doc.size)}</p>
              <p>{doc.body.split(/\r?\n/).length} 行</p>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
