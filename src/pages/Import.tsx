import { useCallback, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  HardDrive,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { PageWash } from '@/components/common/PageWash'
import { StatusDot } from '@/components/common/StatusDot'
import { useLocalDocs } from '@/hooks/useLocalDocs'
import { formatDate, topicLabels } from '@/lib/content'
import {
  deleteLocalDoc,
  formatBytes,
  parseDocText,
  putLocalDoc,
  type LocalDoc,
} from '@/lib/localDocs'
import { topicTone } from '@/lib/tone'
import { cn } from '@/lib/utils'

const ACCEPT = '.md,.mdx,.markdown,.txt,text/markdown,text/plain'
/** 单篇上限：比这个大就不是"笔记"了，而且 localStorage 时代的教训是别把浏览器当网盘 */
const MAX_BYTES = 2 * 1024 * 1024

interface Imported {
  doc: LocalDoc
  warnings: string[]
}

export default function ImportPage() {
  const { docs, ready, reload } = useLocalDocs()
  const [dragging, setDragging] = useState(false)
  const [imported, setImported] = useState<Imported[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ingest = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (list.length === 0) return

      setBusy(true)
      const nextErrors: string[] = []
      const nextImported: Imported[] = []

      for (const file of list) {
        if (!/\.(md|mdx|markdown|txt)$/i.test(file.name)) {
          nextErrors.push(`${file.name}：只支持 .md / .mdx / .markdown / .txt`)
          continue
        }
        if (file.size > MAX_BYTES) {
          nextErrors.push(`${file.name}：${formatBytes(file.size)}，超过 2 MB 上限`)
          continue
        }
        try {
          const text = await file.text()
          if (!text.trim()) {
            nextErrors.push(`${file.name}：文件是空的`)
            continue
          }
          const { doc, warnings } = parseDocText(text, file.name)
          await putLocalDoc(doc)
          nextImported.push({ doc, warnings })
        } catch (error) {
          nextErrors.push(`${file.name}：读取失败（${(error as Error).message}）`)
        }
      }

      await reload()
      setImported(nextImported)
      setErrors(nextErrors)
      setBusy(false)
    },
    [reload],
  )

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void ingest(event.dataTransfer.files)
  }

  const remove = async (id: string) => {
    await deleteLocalDoc(id)
    setPendingDelete(null)
    await reload()
  }

  return (
    <div className="page-shell py-12 sm:py-16">
      <PageWash tone="import" />

      <header className="max-w-[56ch]">
        <p className="font-mono text-label tracking-[0.14em] text-brand-2">IMPORT</p>
        <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">把本地文档放进来</h1>
        <p className="mt-3 text-body text-muted">
          拖入 markdown 文件，它们会和站内笔记进同一个库：能搜索、能按主题筛、能被 ⌘K
          找到。区别只有一个——这些文档只存在你这台设备的浏览器里。
        </p>
        <p className="mt-4 inline-flex items-start gap-2 rounded-sm border border-line bg-surface/50 px-3 py-2 text-meta text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-evergreen" aria-hidden />
          <span>
            没有上传接口，没有账号，没有服务器副本。文件读完就存进 IndexedDB，
            换一台设备、换一个浏览器都读不到。
          </span>
        </p>
      </header>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'mt-10 rounded-lg border border-dashed p-8 text-center transition-colors duration-[var(--motion-base)]',
          dragging
            ? 'border-brand bg-brand-soft'
            : 'border-line-strong bg-surface/30 hover:border-brand/40',
        )}
      >
        <div
          aria-hidden
          className={cn(
            'mx-auto grid h-11 w-11 place-items-center rounded-full transition-colors',
            dragging ? 'btn-brand' : 'bg-surface-2 text-muted',
          )}
        >
          <Upload className="h-5 w-5" aria-hidden />
        </div>

        <p className="mt-4 text-body text-fg">
          {dragging ? '松手就存进本地库' : '把文件拖到这里'}
        </p>
        <p className="mt-1 text-meta text-faint">
          或
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mx-1 text-brand-2 underline decoration-brand-2/40 underline-offset-4 transition-colors hover:decoration-brand-2"
          >
            选择文件
          </button>
          ，可一次选多个
        </p>
        <p className="mt-3 font-mono text-label text-faint">
          .md · .mdx · .markdown · .txt ／ 单篇 ≤ 2 MB
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void ingest(event.target.files)
            // 清空 value：同一个文件改完再拖一次也要能触发 change
            event.target.value = ''
          }}
        />
      </div>

      {busy ? <p className="mt-4 text-meta text-muted">正在读取…</p> : null}

      {errors.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {errors.map((message) => (
            <li
              key={message}
              className="flex items-start gap-2 rounded-sm border border-warn/30 bg-surface/50 px-3 py-2 text-meta text-warn"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      {imported.length > 0 ? (
        <section className="mt-8" aria-label="本次导入结果">
          <h2 className="text-label tracking-[0.06em] text-faint">本次导入 {imported.length} 篇</h2>
          <ul className="mt-3 space-y-2">
            {imported.map(({ doc, warnings }) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-surface/50 px-4 py-3"
              >
                <Check className="h-4 w-4 shrink-0 text-evergreen" aria-hidden />
                <Link
                  to={`/local?id=${doc.id}`}
                  className="min-w-0 flex-1 truncate text-meta text-fg transition-colors hover:text-brand-2"
                >
                  {doc.title}
                </Link>
                <span className="font-mono text-label text-faint">{formatBytes(doc.size)}</span>
                {warnings.length > 0 ? (
                  <span className="text-label text-decision">{warnings.join('；')}</span>
                ) : null}
                <Link
                  to={`/local?id=${doc.id}`}
                  className="inline-flex items-center gap-1 text-label text-brand-2 hover:underline"
                >
                  打开
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-14" aria-label="已导入的文档">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h2 className="text-h3 font-medium text-fg">
            已导入 <span className="font-mono text-meta text-faint">{docs.length}</span>
          </h2>
          <Link to="/notes" className="text-meta text-muted transition-colors hover:text-fg">
            去笔记库看 →
          </Link>
        </div>

        {!ready ? (
          /*
            这里刻意不用骨架条：这一页的"未就绪"是构建期就能确定的（服务端读不到
            IndexedDB），渲染成一句人话比一条灰条更诚实，也避免预渲染产物里
            留下一个永久的 aria-busy。
          */
          <p className="mt-6 text-meta text-faint" aria-live="polite">
            正在读这个浏览器的本地库…
          </p>
        ) : docs.length === 0 ? (
          <p className="mt-6 text-meta text-faint">
            还没有导入任何文档。拖一个 .md 进来试试——文件只留在这台设备上。
          </p>
        ) : (
          <ul>
            {docs.map((doc) => (
              <li key={doc.id} className="border-b border-line">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-faint" aria-hidden />

                  <Link
                    to={`/local?id=${doc.id}`}
                    className="min-w-0 flex-1 truncate text-meta text-fg transition-colors hover:text-brand-2"
                  >
                    {doc.title}
                  </Link>

                  <span
                    className="text-label"
                    style={{ color: topicTone[doc.topic] }}
                    title={`主题：${topicLabels[doc.topic]}`}
                  >
                    {topicLabels[doc.topic]}
                  </span>
                  <StatusDot status={doc.status} className="hidden sm:inline-flex" />
                  <span className="hidden font-mono text-label text-faint tabular-nums md:inline">
                    {doc.fileName}
                  </span>
                  <span className="font-mono text-label text-faint tabular-nums">
                    {formatDate(doc.date)}
                  </span>

                  {pendingDelete === doc.id ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void remove(doc.id)}
                        className="rounded-sm border border-warn/40 px-2 py-0.5 text-label text-warn transition-colors hover:bg-warn/10"
                      >
                        确认删除
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="text-label text-faint transition-colors hover:text-fg"
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(doc.id)}
                      aria-label={`删除 ${doc.title}`}
                      className="grid h-7 w-7 place-items-center rounded-sm text-faint transition-colors hover:bg-surface-2 hover:text-warn"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="mt-14 grid gap-6 rounded-md border border-line bg-surface/40 p-5 sm:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-2 text-label tracking-[0.06em] text-faint">
            <HardDrive className="h-3.5 w-3.5" aria-hidden />
            文件头可选
          </h2>
          <p className="mt-2 text-meta text-muted">
            没有 frontmatter 也能导入：标题取第一个 <code>#</code> 或者文件名，
            摘要取第一段，主题归到「工程」，成熟度算「萌芽」。
          </p>
          <pre className="mt-3 overflow-x-auto rounded-sm border border-line bg-code-bg p-3 font-mono text-label leading-relaxed text-muted">
{`---
title: 我的一篇笔记
date: 2026-10-29
topic: design      # engineering | design | tooling
tags: [阅读, 设计]
status: growing    # seedling | growing | evergreen
---`}
          </pre>
        </div>
        <div>
          <h2 className="text-label tracking-[0.06em] text-faint">边界写清楚</h2>
          <ul className="mt-2 space-y-2 text-meta text-muted">
            <li>· .mdx 里的 React 组件不会执行，会作为文字显示</li>
            <li>· 同名的同一篇再导入一次会覆盖，不会堆两份</li>
            <li>· 清掉浏览器数据，本地文档就没了，站内笔记不受影响</li>
            <li>· 想带走？打开任意一篇，右上角有「导出 .md」</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
