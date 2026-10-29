import type { CSSProperties } from 'react'
import { pageTone, type PageToneId } from '@/lib/tone'

/**
 * 页面顶部的环境色。
 *
 * 用 fixed + 负 z-index 而不是包一层 relative 容器：这样每个页面只需要在根节点
 * 插一行 <PageWash />，不必为了一个背景去改整棵 JSX 的嵌套，也不会和页内
 * 那些自己带 isolate 的区块打架。
 *
 * 纯 CSS 渐变，没有 canvas、没有着色器、没有请求；少一个动效，少一次绘制。
 */
export function PageWash({ tone }: { tone: PageToneId }) {
  const [a, b] = pageTone[tone]

  return (
    <div
      aria-hidden
      className="page-wash"
      style={{ '--wash-a': a, '--wash-b': b } as CSSProperties}
    />
  )
}
