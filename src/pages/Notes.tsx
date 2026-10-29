import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { NoteRow } from '@/components/notes/NoteRow'
import { PageWash } from '@/components/common/PageWash'
import { StatusDot } from '@/components/common/StatusDot'
import { TagChip } from '@/components/common/TagChip'
import { useLocalDocs } from '@/hooks/useLocalDocs'
import { estimateReadingTime } from '@/lib/markdown'
import { notes, statusHints, statusLabels, tagIndex, topicLabels } from '@/lib/content'
import { topicTone } from '@/lib/tone'
import type { Entry, NoteMeta, NoteStatus, TopicId } from '@/lib/content'
import { cn } from '@/lib/utils'

const statuses: NoteStatus[] = ['seedling', 'growing', 'evergreen']
const topicIds = Object.keys(topicLabels) as TopicId[]

// 构建期常量（vite define 注入）：服务端和客户端算出来必须是同一个数
const daysSinceLatestUpdate = notes[0]
  ? Math.max(
      0,
      Math.round(
        (__BUILD_TIME__ - new Date(`${notes[0].meta.updated}T00:00:00`).getTime()) / 86_400_000,
      ),
    )
  : 0

/**
 * 列表里的一行：站内笔记和本地文档走同一套渲染，只差在自己带来的 href 与标记。
 *
 * 本地文档的 meta 是从 IndexedDB 里现读的，它的日期可能比站内任何一篇都新，
 * 所以两边合并后要重新排一次序 —— 否则"刚导入的那篇"会掉到列表最底下。
 */
type Row = Entry<NoteMeta> & { href: string; local: boolean }

/** 筛选状态全部住在 URL 里：刷新不丢，能直接发给别人，也能从命令面板跳进来 */
type Filters = {
  topic: TopicId | 'all'
  status: NoteStatus | 'all'
  tag: string | null
}

export default function Notes() {
  const [params, setParams] = useSearchParams()

  // 参数来自地址栏，可能是手改的、也可能是旧链接，逐个校验再用
  const rawTopic = params.get('topic')
  const rawStatus = params.get('status')
  const filters: Filters = {
    topic: rawTopic && topicIds.includes(rawTopic as TopicId) ? (rawTopic as TopicId) : 'all',
    status:
      rawStatus && statuses.includes(rawStatus as NoteStatus) ? (rawStatus as NoteStatus) : 'all',
    tag: params.get('tag') || null,
  }

  const apply = (patch: Partial<Filters>) => {
    const next = new URLSearchParams(params)
    const write = (key: string, value: string | null | undefined) => {
      if (!value || value === 'all') next.delete(key)
      else next.set(key, value)
    }
    if ('topic' in patch) write('topic', patch.topic)
    if ('status' in patch) write('status', patch.status)
    if ('tag' in patch) write('tag', patch.tag)
    // replace：连点几次筛选不该在浏览器历史里留一串记录
    setParams(next, { replace: true })
  }

  const { docs: localDocs } = useLocalDocs()

  /*
    本地文档在 hydration 之后才出现：初始 [] 让服务端与首帧客户端算出同一棵树，
    读到 IndexedDB 再 set —— 否则预渲染的 6 篇和浏览器的 8 篇会对不上。
  */
  const rows = useMemo<Row[]>(() => {
    const builtin: Row[] = notes.map((note) => ({
      ...note,
      href: `/notes/${note.slug}`,
      local: false,
    }))
    const local: Row[] = localDocs.map((doc) => ({
      slug: doc.id,
      href: `/local?id=${doc.id}`,
      local: true,
      meta: {
        title: doc.title,
        date: doc.date,
        updated: doc.updated,
        topic: doc.topic,
        tags: doc.tags,
        status: doc.status,
        summary: doc.summary,
      },
      toc: [],
      readingTime: estimateReadingTime(doc.body),
    }))
    return [...builtin, ...local].sort((a, b) =>
      a.meta.date === b.meta.date ? Number(b.local) - Number(a.local) : a.meta.date < b.meta.date ? 1 : -1,
    )
  }, [localDocs])

  const topics = useMemo(() => {
    const counts = new Map<TopicId, number>()
    for (const row of rows) counts.set(row.meta.topic, (counts.get(row.meta.topic) ?? 0) + 1)
    return [...counts.entries()]
  }, [rows])

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (filters.topic === 'all' || row.meta.topic === filters.topic) &&
          (filters.status === 'all' || row.meta.status === filters.status) &&
          (!filters.tag || row.meta.tags.includes(filters.tag)),
      ),
    [rows, filters.topic, filters.status, filters.tag],
  )

  const dirty = filters.topic !== 'all' || filters.status !== 'all' || filters.tag !== null
  const latestDays = daysSinceLatestUpdate

  return (
    <div className="page-shell py-12 sm:py-16">
      <PageWash tone="notes" />
      <header className="max-w-[52ch]">
        <p className="font-mono text-label tracking-[0.14em] text-brand-2">NOTES</p>
        <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">笔记库</h1>
        <p className="mt-3 text-body text-muted">
          共 {rows.length} 篇 · {topics.length} 个主题 · 最近 {latestDays} 天内有更新。
          成熟度不是进度条，是我对结论确定程度的诚实标注。
        </p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[170px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="text-label tracking-[0.06em] text-faint">主题</div>
          <div className="mt-2 flex flex-wrap gap-1.5 lg:flex-col lg:items-start">
            <button
              type="button"
              onClick={() => apply({ topic: 'all' })}
              className={cn(
                'text-meta transition-colors duration-[var(--motion-fast)]',
                filters.topic === 'all' ? 'text-fg' : 'text-muted hover:text-fg',
              )}
            >
              全部 <span className="font-mono text-label text-faint">{rows.length}</span>
            </button>
            {topics.map(([id, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => apply({ topic: id })}
                className={cn(
                  'group inline-flex items-center gap-1.5 text-meta transition-colors duration-[var(--motion-fast)]',
                  filters.topic === id ? '' : 'text-muted hover:text-fg',
                )}
                style={filters.topic === id ? { color: topicTone[id] } : undefined}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full transition-opacity duration-[var(--motion-fast)]"
                  style={{
                    backgroundColor: topicTone[id],
                    opacity: filters.topic === id ? 1 : 0.55,
                  }}
                />
                {topicLabels[id]} <span className="font-mono text-label text-faint">{count}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <div className="text-label tracking-[0.06em] text-faint">成熟度</div>
            <ul className="mt-2 space-y-2">
              {statuses.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => apply({ status: filters.status === item ? 'all' : item })}
                    aria-pressed={filters.status === item}
                    className={cn(
                      'w-full text-left transition-opacity duration-[var(--motion-fast)]',
                      filters.status === item ? 'opacity-100' : 'opacity-70 hover:opacity-100',
                    )}
                  >
                    <StatusDot status={item} />
                    <span className="mt-0.5 block pl-3 text-label text-faint">
                      {statusHints[item]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="font-mono text-label text-faint">{filtered.length} 条结果</span>
              {filters.tag ? (
                <button
                  type="button"
                  onClick={() => apply({ tag: null })}
                  className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand-soft px-2 py-0.5 font-mono text-label text-brand transition-colors hover:border-brand"
                  aria-label={`取消 ${filters.tag} 标签筛选`}
                >
                  #{filters.tag}
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </div>
            {dirty ? (
              <button
                type="button"
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className="shrink-0 text-label text-muted transition-colors hover:text-fg"
              >
                清除筛选
              </button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-body text-muted">
                {filters.tag ? `还没有笔记带 #${filters.tag} 这个标签。` : '这个组合下还没有笔记。'}
              </p>
              <p className="mt-2 text-meta text-faint">
                成熟度里的「{filters.status !== 'all' ? statusLabels[filters.status] : '—'}
                」通常是缺口最大的地方。
              </p>
            </div>
          ) : (
            <div>
              {filtered.map((row) => (
                <NoteRow key={row.slug} note={row} href={row.href} local={row.local} />
              ))}
            </div>
          )}

          {/* 标签按篇数倒序：用得多的排在前面，比按字母排更有信息 */}
          <div className="mt-6 flex flex-wrap gap-1.5">
            {tagIndex.slice(0, 12).map(([tag]) => (
              <TagChip
                key={tag}
                active={filters.tag === tag}
                onClick={() => apply({ tag: filters.tag === tag ? null : tag })}
              >
                {tag}
              </TagChip>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
