import { useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  LIMITS,
  authNameSnapshot,
  authStartUrl,
  postComment,
  rememberNick,
  savedNick,
  signOut,
  subscribeStore,
  type Comment,
  type CommentScope,
} from '@/lib/comments'
import { cn } from '@/lib/utils'

interface Props {
  scope: CommentScope
  thread: string
  /** 服务端配了 GitHub OAuth 才为 true；false 时连入口都不出现，不放假的按钮 */
  authEnabled: boolean
  onPosted: (comment: Comment) => void
}

/**
 * 留言表单。
 *
 * 昵称和登录态是「外部状态」（localStorage），用 useSyncExternalStore 读：
 * 它的 server snapshot 固定返回空，预渲染产物和客户端首帧就永远一致，
 * 挂载后再切到真实值，不需要在 effect 里 setState。
 *
 * 昵称要能编辑，所以本地改动单独放 nickEdit，没动过就跟着记住的值走。
 */
export function CommentForm({ scope, thread, authEnabled, onPosted }: Props) {
  const userName = useSyncExternalStore(subscribeStore, authNameSnapshot, () => '')
  const rememberedNick = useSyncExternalStore(subscribeStore, savedNick, () => '')

  const [nickEdit, setNickEdit] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const nick = nickEdit ?? rememberedNick
  const signedIn = userName.length > 0
  const trimmed = body.trim()
  const overflow = body.length > LIMITS.body
  const needNick = !signedIn && nick.trim().length === 0
  const canSubmit = !pending && trimmed.length > 0 && !overflow && !needNick

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    setPending(true)
    setError('')
    try {
      const comment = await postComment({
        scope,
        thread,
        nick: nick.trim(),
        body: trimmed,
        website: honeypot,
      })

      // 蜜罐命中时服务端只回 { ok: true }，不会有 item —— 那就不当成功，也不报错
      if (comment) {
        onPosted(comment)
        setBody('')
        if (nick.trim()) rememberNick(nick.trim())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，稍后再试')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="overflow-hidden rounded-md border border-line bg-surface/40 transition-colors focus-within:border-brand/45">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line/60 px-4 py-2.5">
          {signedIn ? (
            <span className="flex items-center gap-2 text-meta text-muted">
              以
              <span className="font-medium text-fg">{userName}</span>
              的身份留言
              <button
                type="button"
                onClick={() => {
                  signOut()
                  setNickEdit(null)
                }}
                className="inline-flex items-center gap-1 text-label text-muted transition-colors hover:text-fg"
              >
                <LogOut className="h-3 w-3" aria-hidden />
                退出
              </button>
            </span>
          ) : (
            <input
              value={nick}
              onChange={(event) => setNickEdit(event.target.value)}
              maxLength={LIMITS.name}
              placeholder="昵称"
              aria-label="昵称"
              className="w-40 bg-transparent text-meta text-fg outline-none placeholder:text-faint"
            />
          )}

          {authEnabled && !signedIn ? (
            <a
              href={authStartUrl()}
              className="text-label text-muted transition-colors hover:text-brand"
            >
              用 GitHub 登录
            </a>
          ) : (
            <span className="text-label text-muted">不用登录</span>
          )}
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="说点什么…"
          aria-label="留言内容"
          className={cn(
            'block w-full resize-y bg-transparent px-4 py-3 text-meta leading-relaxed text-fg',
            'outline-none placeholder:text-faint',
          )}
        />

        <div className="flex items-center justify-between gap-3 px-4 pb-3">
          <span
            className={cn(
              'font-mono text-label tabular-nums',
              overflow ? 'text-warn' : 'text-faint',
            )}
          >
            {body.length} / {LIMITS.body}
          </span>

          <Button type="submit" size="sm" disabled={!canSubmit}>
            {pending ? '发送中…' : '发布'}
          </Button>
        </div>
      </div>

      {/* 真人看不见；自动填表的脚本会把每个 input 都写上，这一栏一有值就整条丢掉 */}
      <input
        value={honeypot}
        onChange={(event) => setHoneypot(event.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="comment-honeypot"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-label text-muted">文字原样显示，不支持 Markdown。发完可以删。</p>
        {error ? (
          <p role="alert" className="text-label text-warn">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  )
}
