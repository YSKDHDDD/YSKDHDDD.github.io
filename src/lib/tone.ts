import type { TopicId } from './content'

/**
 * 主题 → 色相。
 *
 * 只给出 CSS 变量名，不给出具体颜色：两套主题的取值都在 index.css 里，
 * 组件不需要知道深色模式下设计粉要亮一档这件事。
 */
export const topicTone: Record<TopicId, string> = {
  engineering: 'var(--topic-engineering)',
  design: 'var(--topic-design)',
  tooling: 'var(--topic-tooling)',
}

/** 页面环境色：a 从左上来，b 从右上来。缺省就用品牌色，不需要每页都写 */
export const pageTone = {
  home: ['var(--brand)', 'var(--brand-2)'],
  me: ['var(--topic-design)', 'var(--brand)'],
  notes: ['var(--topic-engineering)', 'var(--brand)'],
  retro: ['var(--brand)', 'var(--decision)'],
  craft: ['var(--brand-2)', 'var(--brand)'],
  about: ['var(--topic-tooling)', 'var(--brand)'],
  import: ['var(--brand-2)', 'var(--topic-tooling)'],
} as const

export type PageToneId = keyof typeof pageTone
