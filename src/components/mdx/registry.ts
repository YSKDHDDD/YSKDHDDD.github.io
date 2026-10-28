import type { ElementType } from 'react'
import { Callout, DecisionCard } from './index'
import { MDXLink, MDXTable } from './components'

/**
 * 这份映射被注入到每篇 MDX 的编译结果里。
 * 单独一个文件是因为它只导出常量，组件文件只导出组件 —— 两者混在一起会破坏 fast refresh。
 */
export const mdxComponents: Record<string, ElementType> = {
  a: MDXLink,
  table: MDXTable,
  Callout,
  DecisionCard,
}
