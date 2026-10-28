import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import { Check, Copy } from 'lucide-react'

const RESET_MS = 1600

/**
 * 代码块 + 复制按钮。
 *
 * rehype-pretty-code 把 `<pre>` 包进 `<figure>`，这里只接管 `pre`，不碰高亮结果：
 * 文本从 DOM 里取，插件已按行切成 `<span data-line>`，textContent 之间仍留着换行。
 * 按钮做成 `pre` 的兄弟节点而不是子节点 —— `pre` 会横向滚动，塞进去会跟着一起滚走。
 */
export function CodeBlock({ children, ...rest }: ComponentPropsWithoutRef<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handle = timer
    return () => window.clearTimeout(handle.current)
  }, [])

  const copy = async () => {
    const text = preRef.current?.querySelector('code')?.textContent?.replace(/\n$/, '') ?? ''
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 非安全上下文（http 局域网调试）下 clipboard 不可用，退回文本选区
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.top = '-9999px'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }

    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), RESET_MS)
  }

  return (
    <div className="code-block">
      <pre ref={preRef} {...rest}>
        {children}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="code-copy"
        data-copied={copied || undefined}
        aria-label={copied ? '已复制' : '复制代码'}
        title={copied ? '已复制' : '复制代码'}
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      </button>
    </div>
  )
}
