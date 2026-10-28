import { useMemo, useState } from 'react'
import { NoteRow } from '@/components/notes/NoteRow'
import { StatusDot } from '@/components/common/StatusDot'
import { TagChip } from '@/components/common/TagChip'
import { notes, statusHints, statusLabels, topicLabels } from '@/lib/content'
import type { NoteStatus, TopicId } from '@/lib/content'
import { cn } from '@/lib/utils'

const statuses: NoteStatus[] = ['seedling', 'growing', 'evergreen']

// 构建期常量（vite define 注入）：服务端和客户端算出来必须是同一个数
const daysSinceLatestUpdate = notes[0]
  ? Math.max(
      0,
      Math.round(
        (__BUILD_TIME__ - new Date(`${notes[0].meta.updated}T00:00:00`).getTime()) / 86_400_000,
      ),
    )
  : 0

export default function Notes() {
  const [topic, setTopic] = useState<TopicId | 'all'>('all')
  const [status, setStatus] = useState<NoteStatus | 'all'>('all')

  const topics = useMemo(() => {
    const counts = new Map<TopicId, number>()
    for (const note of notes) counts.set(note.meta.topic, (counts.get(note.meta.topic) ?? 0) + 1)
    return [...counts.entries()]
  }, [])

  const filtered = useMemo(
    () =>
      notes.filter(
        (note) =>
          (topic === 'all' || note.meta.topic === topic) &&
          (status === 'all' || note.meta.status === status),
      ),
    [topic, status],
  )

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
              onClick={() => setTopic('all')}
              className={cn(
                'text-meta transition-colors duration-[var(--motion-fast)]',
                topic === 'all' ? 'text-fg' : 'text-muted hover:text-fg',
              )}
            >
              全部 <span className="font-mono text-label text-faint">{notes.length}</span>
            </button>
            {topics.map(([id, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTopic(id)}
                className={cn(
                  'text-meta transition-colors duration-[var(--motion-fast)]',
                  topic === id ? 'text-fg' : 'text-muted hover:text-fg',
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
                    onClick={() => setStatus((prev) => (prev === item ? 'all' : item))}
                    aria-pressed={status === item}
                    className={cn(
                      'w-full text-left transition-opacity duration-[var(--motion-fast)]',
                      status === item ? 'opacity-100' : 'opacity-70 hover:opacity-100',
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
          <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
            <span className="font-mono text-label text-faint">{filtered.length} 条结果</span>
            {(topic !== 'all' || status !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setTopic('all')
                  setStatus('all')
                }}
                className="text-label text-muted transition-colors hover:text-fg"
              >
                清除筛选
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-body text-muted">这个组合下还没有笔记。</p>
              <p className="mt-2 text-meta text-faint">
                成熟度里的「{status !== 'all' ? statusLabels[status] : '—'}」通常是缺口最大的地方。
              </p>
            </div>
          ) : (
            <div>
              {filtered.map((note) => (
                <NoteRow key={note.slug} note={note} />
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-1.5">
            {[...new Set(notes.flatMap((note) => note.meta.tags))].slice(0, 12).map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
