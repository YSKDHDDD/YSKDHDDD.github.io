import { flushSync } from 'react-dom'

/**
 * 路由切换过渡（DESIGN_PLAN §4 的 enter 档）。
 *
 * 为什么不用 CSS 入场动画：那会和 Reveal 叠成两层淡入 —— 容器淡入时里面元素还是
 * opacity:0，等 Reveal 再触发，首屏读起来像"一直在加载"。View Transitions 做的是
 * 旧页面淡出 + 新页面淡入的交叉，语义上是导航反馈，不是入场。
 *
 * 唯一要小心的坑是 Suspense：页面是 lazy 的，chunk 没就绪时 flushSync 会提交一个
 * 空白的 fallback，过渡就截到白屏帧。所以导航前先等预热过的 chunk（见
 * pages/index.ts 的 preloadRoute），并给它一个上限 —— 宁可少一次过渡，也不能让点击没反应。
 */

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

/** chunk 预热的最长等待。超过就当作没有过渡可用，直接导航。 */
const PRELOAD_BUDGET = 320

/** View Transitions 的运行时能力检测（类型层面 lib.dom 已有，老浏览器是 undefined） */
export function supportsViewTransition(): boolean {
  if (typeof document === 'undefined') return false
  if (typeof document.startViewTransition !== 'function') return false
  return !window.matchMedia(REDUCE_QUERY).matches
}

/**
 * flushSync 是必需的：React 的状态更新默认异步，不强制同步提交的话
 * startViewTransition 截新快照时 DOM 还停在旧页面上，过渡就没有内容可放。
 */
export function runViewTransition(update: () => void): void {
  if (!supportsViewTransition()) {
    update()
    return
  }

  document.startViewTransition(() => {
    flushSync(update)
  })
}

/** 给 chunk 预热加超时，避免弱网下点击长时间无响应 */
export function withPreloadBudget(work: Promise<unknown>): Promise<void> {
  return Promise.race([
    work.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, PRELOAD_BUDGET)
    }),
  ])
}
