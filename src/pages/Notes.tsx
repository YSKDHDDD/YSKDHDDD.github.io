import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { NoteRow } from '@/components/notes/NoteRow'
import { StatusDot } from '@/components/common/StatusDot'
import { TagChip } from '@/components/common/TagChip'
import { notes, statusHints, statusLabels, tagIndex, topicLabels } from '@/lib/content'
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

  const topics = useMemo(() => {
    const counts = new Map<TopicId, number>()
    for (const note of notes) counts.set(note.meta.topic, (counts.get(note.meta.topic) ?? 0) + 1)
    return [...counts.entries()]
  }, [])

  const filtered = useMemo(
    () =>
      notes.filter(
        (note) =>
          (filters.topic === 'all' || note.meta.topic === filters.topic) &&
          (filters.status === 'all' || note.meta.status === filters.status) &&
          (!filters.tag || note.meta.tags.includes(filters.tag)),
      ),
    [filters.topic, filters.status, filters.tag],
  )

  const dirty = filters.topic !== 'all' || filters.status !== 'all' || filters.tag !== null
  const latestDays = daysSinceLatestUpdate

  return (
    <div className="page-shell py-12 sm:py-16">
      <header className="max-w-[52ch]">
        <p className="font-mono text-label tracking-[0.14em] text-faint">NOTES</p>
        <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">笔记库</h1>
        <p className="mt-3 text-body text-muted">
          共 {notes.length} 篇 · {topics.length} 个主题 · 最近 {latestDays} 天内有更新。
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
              全部 <span className="font-mono text-label text-faint">{notes.length}</span>
            </button>
            {topics.map(([id, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => apply({ topic: id })}
                className={cn(
                  'text-meta transition-colors duration-[var(--motion-fast)]',
                  filters.topic === id ? 'text-fg' : 'text-muted hover:text-fg',
                )}
              >
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
              {filtered.map((note) => (
                <NoteRow key={note.slug} note={note} />
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
