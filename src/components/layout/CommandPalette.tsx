import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Fuse from 'fuse.js'
import { CornerDownLeft, Search } from 'lucide-react'
import { searchIndex, type SearchItem } from '@/lib/content'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'

/**
 * 本地检索：索引在构建期就生成了，这里只有 Fuse 一个运行时依赖，
 * 不发请求、不需要后端，也就能做到"按下就有结果"。
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement | null>(null)

  const fuse = useMemo(
    () =>
      new Fuse(searchIndex, {
        keys: ['title', 'summary', 'tags'],
        threshold: 0.36,
        ignoreLocation: true,
      }),
    [],
  )

  const results: SearchItem[] = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return searchIndex.slice(0, 6)
    return fuse.search(trimmed).map((hit) => hit.item).slice(0, 8)
  }, [fuse, query])

  // 重置放在事件里而不是 effect 里：effect 里同步 setState 会多渲染一轮
  const changeQuery = (value: string) => {
    setQuery(value)
    setActive(0)
  }

  const close = () => {
    setQuery('')
    setActive(0)
    onOpenChange(false)
  }

  const commit = (item: SearchItem | undefined) => {
    if (!item) return
    close()
    navigate(item.href)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((prev) => (prev + 1) % Math.max(results.length, 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((prev) => (prev - 1 + results.length) % Math.max(results.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commit(results[active])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} className="pt-[14vh]">
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden />
        <input
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="搜索笔记、复盘、标签…"
          aria-label="搜索"
          className="h-12 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-faint"
        />
        <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-label text-faint">
          Esc
        </kbd>
      </div>

      <div className="max-h-[52vh] overflow-y-auto py-1.5">
        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-meta text-faint">没有匹配的内容</p>
        ) : (
          <ul ref={listRef} role="listbox" aria-label="搜索结果">
            {results.map((item, index) => (
              <li key={`${item.group}-${item.id}`} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(item)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left',
                    'transition-colors duration-[var(--motion-fast)]',
                    index === active ? 'bg-surface-2' : 'bg-transparent',
                  )}
                >
                  <span className="w-9 shrink-0 text-label text-faint">{item.group}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-meta text-fg">{item.title}</span>
                    <span className="mt-0.5 block truncate text-label text-faint">
                      {item.summary}
                    </span>
                  </span>
                  {index === active ? (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-label text-faint">
        <span>↑ ↓ 选择</span>
        <span>↵ 打开</span>
        <span className="ml-auto font-mono">共 {searchIndex.length} 条</span>
      </div>
    </Dialog>
  )
}
