import { ChevronDown } from 'lucide-react'
import { topicLabels, type TopicId } from '@/lib/content'
import { topicTone } from '@/lib/tone'
import { cn } from '@/lib/utils'

/** 下拉里的顺序固定，不按当前值排 —— 位置固定的选项才能靠肌肉记忆选中 */
const ORDER: TopicId[] = ['engineering', 'design', 'tooling', 'misc']

/**
 * 主题选择器。
 *
 * 用原生 `<select>` 而不是自绘下拉：它自带键盘操作、屏幕阅读器语义和
 * 移动端的系统选择器，自己写一个要补的正是这三样。代价是长得朴素，
 * 所以只在该朴素的地方用它 —— 它出现在列表行尾和文章头部，
 * 是个"改一下"的工具，不该抢走注意力。
 *
 * 色点跟着主题色走，文字不染色：`option` 的配色由系统决定，
 * 把文字染成浅粉再展开一个深色的选项列表，反而看不清。
 */
export function TopicPicker({
  value,
  onChange,
  className,
  label = '主题',
}: {
  value: TopicId
  onChange: (next: TopicId) => void
  className?: string
  /** 屏幕上不显示，给读屏用；列表里一屏会有好几个选择器，必须能区分是谁的 */
  label?: string
}) {
  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-1 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: topicTone[value] }}
      />
      <select
        aria-label={label}
        title="改主题"
        value={value}
        onChange={(event) => onChange(event.target.value as TopicId)}
        className={cn(
          'cursor-pointer appearance-none rounded-full border border-transparent bg-transparent',
          'py-0.5 pr-5 pl-3.5 text-label text-muted',
          'transition-colors duration-[var(--motion-fast)]',
          'hover:border-line hover:text-fg focus-visible:border-line-strong focus-visible:text-fg',
          'focus-visible:outline-none',
        )}
      >
        {ORDER.map((topic) => (
          <option key={topic} value={topic}>
            {topicLabels[topic]}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-1 h-3 w-3 text-faint"
        aria-hidden
      />
    </span>
  )
}
