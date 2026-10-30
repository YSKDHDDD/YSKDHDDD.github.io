import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { ArchiveTimeline } from '@/components/notes/ArchiveTimeline'
import { NoteRow } from '@/components/notes/NoteRow'
import { PageWash } from '@/components/common/PageWash'
import { StatusDot } from '@/components/common/StatusDot'
import { TagChip } from '@/components/common/TagChip'
import { useEntryRows } from '@/hooks/useEntryRows'
import { notes, statusHints, statusLabels, tagIndex, topicLabels } from '@/lib/content'
import { topicTone } from '@/lib/tone'
import type { NoteStatus, TopicId } from '@/lib/content'
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

/** 筛选状态全部住在 URL 里：刷新不丢，能直接发给别人，也能从命令面板跳进来 */
type Filters = {
  topic: TopicId | 'all'
  status: NoteStatus | 'all'
  tag: string | null
}

/**
 * 同一批内容的两种读法：列表回答"有哪些"，时间线回答"什么时候写的"。
 * 视图也进 URL（?view=timeline），否则筛完一批再切视图就丢了上下文。
 */
type View = 'list' | 'timeline'

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

  const view: View = params.get('view') === 'timeline' ? 'timeline' : 'list'

  /** 换视图不动筛选：两种读法看的是同一批行，切换只该改排版 */
  const setView = (next: View) => {
    const query = new URLSearchParams(params)
    if (next === 'timeline') query.set('view', 'timeline')
    else query.delete('view')
    setParams(query, { replace: true })
  }

  /* 行数据由 hook 统一合并站内笔记与本地文档 —— 归档页用的是同一份 */
  const rows = useEntryRows()

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
      {/* 归档并进这一页之后，切换的是「读法」而不是页面：
          同一个筛选结果，列表按主题看，时间线按年份看 */}
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-label tracking-[0.14em] text-brand-2">NOTES</p>
        <div
          role="group"
          aria-label="切换视图"
          className="inline-flex items-center gap-0.5 rounded-full border border-line p-0.5"
        >
          {(
            [
              ['list', '列表'],
              ['timeline', '时间线'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={cn(
                'rounded-full px-2.5 py-1 font-mono text-label transition-colors duration-[var(--motion-fast)]',
                view === id ? 'bg-brand-soft text-brand' : 'text-faint hover:text-fg',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <header className="mt-4 max-w-[52ch]">
        <h1 className="text-h1 font-medium tracking-[-0.02em] text-fg">笔记库</h1>
        <p className="mt-3 text-body text-muted">
          共 {rows.length} 篇 · {topics.length} 个主题 · 最近 {latestDays} 天内有更新。
          成熟度不是进度条，是我对结论确定程度的诚实标注。
        </p>
      </header>

      {/*
        `minmax(0,1fr)` 与下面那两个 min-w-0 是同一个 bug 的两道保险。
        列表行的摘要是 truncate（white-space: nowrap），它的最小内容宽度等于
        整段文字，grid 轨道的 min-content 因此被撑到 725px —— 390px 的屏幕上
        整页横向溢出 359px。grid 项的 min-width 默认是 auto，必须显式压住，
        truncate 才真的会截断而不是把容器顶开。
      */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[170px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
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

        <div className="min-w-0">
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
                onClick={() => {
                  // 只清筛选，不动视图：点「清除筛选」不该顺带把我从时间线踢回列表
                  const query = new URLSearchParams()
                  if (view === 'timeline') query.set('view', 'timeline')
                  setParams(query, { replace: true })
                }}
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
          ) : view === 'timeline' ? (
            <ArchiveTimeline rows={filtered} />
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
