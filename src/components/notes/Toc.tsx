import { useMemo } from 'react'
import type { TocItem } from '@/lib/content'
import { useActiveSection } from '@/hooks/useActiveSection'
import { cn } from '@/lib/utils'

/** 目录复用原有的 scroll-spy，只是从"分区高亮"换成"标题高亮" */
export function Toc({ items }: { items: TocItem[] }) {
  const ids = useMemo(() => items.map((item) => item.id), [items])
  const activeId = useActiveSection(ids, 120)

  if (items.length === 0) return null

  return (
    <nav aria-label="本页目录" className="sticky top-28 hidden lg:block">
      <div className="mb-2 text-label tracking-[0.06em] text-faint">目录</div>
      <ul className="space-y-1.5 border-l border-line">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                'block border-l py-0.5 pl-3 text-meta leading-snug transition-colors duration-[var(--motion-fast)]',
                item.depth === 3 && 'pl-5',
                activeId === item.id
                  ? 'border-brand text-fg'
                  : 'border-transparent text-faint hover:text-muted',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
