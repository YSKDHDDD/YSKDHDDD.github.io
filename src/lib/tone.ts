import type { TopicId } from './content'

/**
 * 主题 → 色相。
 *
 * 只给出 CSS 变量名，不给出具体颜色：两套主题的取值都在 index.css 里，
 * 组件不需要知道深色模式下设计粉要亮一档这件事。
 */
export const topicTone: Record<TopicId, string> = {
  structure: 'var(--topic-structure)',
  styling: 'var(--topic-styling)',
  content: 'var(--topic-content)',
  reading: 'var(--topic-reading)',
  motion: 'var(--topic-motion)',
  delivery: 'var(--topic-delivery)',
  // 未分类刻意用中性色：它不是一种"主题"，只是"还没归类"的诚实表示
  misc: 'var(--topic-misc)',
}

/** 页面环境色：a 从左上来，b 从右上来。缺省就用品牌色，不需要每页都写 */
export const pageTone = {
  home: ['var(--brand)', 'var(--brand-2)'],
  me: ['var(--topic-styling)', 'var(--brand)'],
  notes: ['var(--topic-structure)', 'var(--brand)'],
  retro: ['var(--brand)', 'var(--decision)'],
  // 生活页用暖色打底：它是全站唯一不讲道理的页面，底色也不该跟着品牌紫走
  life: ['var(--decision)', 'var(--brand)'],
  craft: ['var(--brand-2)', 'var(--brand)'],
  about: ['var(--topic-content)', 'var(--brand)'],
  import: ['var(--brand-2)', 'var(--topic-content)'],
} as const

export type PageToneId = keyof typeof pageTone
