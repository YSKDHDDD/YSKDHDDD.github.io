import { useState } from 'react'
import type { CSSProperties } from 'react'
import { BadgeCheck } from 'lucide-react'
import { avatarHue, relativeTime, removeComment, type Comment } from '@/lib/comments'
import { cn } from '@/lib/utils'

interface Props {
  comment: Comment
  onRemoved: (id: string) => void
}

export function CommentItem({ comment, onRemoved }: Props) {
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    if (removing) return
    if (!window.confirm('删掉这条留言？删了就找不回来了。')) return

    setRemoving(true)
    try {
      await removeComment(comment.id)
      onRemoved(comment.id)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '删除失败')
      setRemoving(false)
    }
  }

  // Array.from 而不是 [0]：昵称第一个字是 emoji 时，按 UTF-16 取会切出半个代理对
  const initial = Array.from(comment.author.name)[0]?.toUpperCase() ?? '?'

  return (
    <li className={cn('comment-item flex gap-3', removing && 'opacity-40')}>
      <span
        className="comment-avatar"
        style={{ '--hue': avatarHue(comment.author.name) } as CSSProperties}
        aria-hidden="true"
      >
        {initial}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-meta font-medium text-fg">{comment.author.name}</span>

          {comment.author.provider === 'github' ? (
            <BadgeCheck className="h-3.5 w-3.5 self-center text-brand" aria-label="GitHub 账号" />
          ) : null}

          <time dateTime={new Date(comment.createdAt).toISOString()} className="text-label text-faint">
            {relativeTime(comment.createdAt)}
          </time>

          {comment.mine ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="text-label text-muted transition-colors hover:text-warn disabled:opacity-50"
            >
              删除
            </button>
          ) : null}
        </div>

        <p className="mt-1.5 text-meta leading-relaxed break-words whitespace-pre-wrap text-muted">
          {comment.body}
        </p>
      </div>
    </li>
  )
}
