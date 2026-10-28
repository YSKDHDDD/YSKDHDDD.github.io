import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatDate, topicLabels, type SearchItem } from '@/lib/content'

interface RelatedReadingProps {
  items: SearchItem[]
  /** 当前这篇的标签，用来标出「为什么推荐它」 */
  currentTags: string[]
}

/**
 * 文末的「接着读」。
 *
 * 每张卡下面那行是这条推荐的理由：共同标签优先，没有共同标签就退回同主题 ——
 * 不写清理由的推荐，读者只能当成随机内容。
 */
export function RelatedReading({ items, currentTags }: RelatedReadingProps) {
  if (items.length === 0) return null

  return (
    <section className="mt-16">
      <h2 className="text-label tracking-[0.06em] text-faint">接着读</h2>
      <ul
        className={cn(
          'mt-4 grid gap-px overflow-hidden rounded-md border border-line bg-line',
          // 列数跟着结果数走：两篇却留三格，空出来那格会露出分隔线的底色
          items.length === 1 ? 'sm:grid-cols-1' : items.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
        )}
      >
        {items.map((item) => {
          const shared = item.tags.filter((tag) => currentTags.includes(tag))
          return (
            <li key={item.href}>
              <Link
                to={item.href}
                className="flex h-full flex-col gap-2 bg-bg p-4 transition-colors hover:bg-surface"
              >
                <span className="font-mono text-label text-faint">
                  {item.group} · {formatDate(item.date)}
                </span>
                <span className="text-meta leading-snug text-fg">{item.title}</span>
                <span className="mt-auto font-mono text-label text-faint">
                  {shared.length > 0
                    ? shared.map((tag) => `#${tag}`).join(' ')
                    : `${topicLabels[item.topic]}主题`}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
