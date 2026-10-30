import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'
import {
  commentsEnabled,
  fetchComments,
  loadConfig,
  type Comment,
  type CommentConfig,
  type CommentScope,
} from '@/lib/comments'
import { cn } from '@/lib/utils'
import './CommentSection.css'

interface Props {
  scope: CommentScope
  thread: string
  title?: string
  hint?: string
  className?: string
}

/**
 * 没配 VITE_COMMENTS_API 时整块不渲染。
 *
 * 这层判断放在外层而不是 Thread 内部：如果 hooks 前面有条件 return，
 * 一旦这个常量在开发期变化（改 .env 热重载），hooks 数量就错位了。
 */
export function CommentSection(props: Props) {
  if (!commentsEnabled) return null

  // key 跟着分区走：换一篇文章就整块重挂载，phase / items 自然回到初始值，
  // 不用在 effect 里先 setPhase('loading') 再覆盖 —— 那会多一次级联渲染，也会闪一下旧留言
  return <CommentThread key={`${props.scope}:${props.thread}`} {...props} />
}

function CommentThread({ scope, thread, title, hint, className }: Props) {
  const [items, setItems] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  const [next, setNext] = useState<number | null>(null)
  const [config, setConfig] = useState<CommentConfig | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let alive = true

    Promise.all([loadConfig(), fetchComments(scope, thread)])
      .then(([loaded, page]) => {
        if (!alive) return
        setConfig(loaded)
        setItems(page.items)
        setTotal(page.total)
        setNext(page.next)
        setPhase('ready')
      })
      .catch((err: unknown) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : '加载失败')
        setPhase('error')
      })

    return () => {
      alive = false
    }
  }, [scope, thread])

  const handlePosted = useCallback((comment: Comment) => {
    setItems((prev) => [comment, ...prev])
    setTotal((prev) => prev + 1)
  }, [])

  const handleRemoved = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setTotal((prev) => Math.max(0, prev - 1))
  }, [])

  async function loadMore() {
    if (next === null || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchComments(scope, thread, next)
      setItems((prev) => [...prev, ...page.items])
      setNext(page.next)
      setTotal(page.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoadingMore(false)
    }
  }

  const headingId = `comments-${scope}-${thread}`
  const heading = title ?? (scope === 'guest' ? '留言板' : '留言')
  const subtitle = hint ?? (scope === 'guest' ? '不用登录。想说什么就写，我都能看到。' : '读到这里，说两句。不用登录，昵称随便填。')

  return (
    <section aria-labelledby={headingId} className={cn('comment-section', className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-h3 font-medium tracking-[-0.01em] text-fg">
          {heading}
        </h2>
        <span className="font-mono text-label text-faint">
          {total > 0 ? `${total} 条` : '还没有人说话'}
        </span>
      </header>

      <p className="mt-2 text-meta leading-relaxed text-muted">{subtitle}</p>

      <CommentForm
        scope={scope}
        thread={thread}
        authEnabled={config?.auth ?? false}
        onPosted={handlePosted}
      />

      {/*
        骨架屏不能带 aria-busy：那是「整页主体是空的」这个全局约定，
        预渲染脚本拿它判断页面有没有渲染成功。这里的骨架只是留言列表的占位，
        对读屏软件也没有意义，标 aria-hidden 更准确。
      */}
      {phase === 'loading' ? (
        <div className="mt-8 space-y-4" aria-hidden="true">
          {[0, 1].map((row) => (
            <div key={row} className="flex gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-2" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-28 animate-pulse rounded-sm bg-surface-2" />
                <div className="h-3 w-full max-w-[420px] animate-pulse rounded-sm bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {phase === 'error' ? (
        <p className="mt-8 text-meta text-muted">留言暂时连不上（{error}）。刷新页面试试。</p>
      ) : null}

      {phase === 'ready' && items.length === 0 ? (
        <p className="mt-8 border-t border-line pt-6 text-meta text-muted">
          {scope === 'guest' ? '还没有留言。第一条归你了。' : '还没有留言。有补充或不同看法，写在这里。'}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ol className="mt-8 space-y-6 border-t border-line pt-6">
          {items.map((comment) => (
            <CommentItem key={comment.id} comment={comment} onRemoved={handleRemoved} />
          ))}
        </ol>
      ) : null}

      {next !== null ? (
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? '加载中…' : '看更早的'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
