import { lazy } from 'react'

/**
 * 页面组件的懒加载版本（浏览器用）。
 *
 * 为什么单独放一个文件：预渲染时 shiki/MDX 正文必须在**同步**渲染路径上，
 * 否则 React 流式 SSR 会把整页塞进 <div hidden id="S:0"> 再靠内联 script 搬回去 ——
 * 爬虫不执行 JS，等于什么都没渲染。
 *
 * vite.config.ts 在 SSR 构建时把这个模块 alias 到 index.eager.ts，
 * 所以 App.tsx 只有一份，不需要为两种渲染方式各维护一套路由。
 */
export const Home = lazy(() => import('./Home'))
export const Me = lazy(() => import('./Me'))
export const Notes = lazy(() => import('./Notes'))
export const NoteDetail = lazy(() => import('./NoteDetail'))
export const LocalDoc = lazy(() => import('./LocalDoc'))
export const ImportPage = lazy(() => import('./Import'))
export const Retro = lazy(() => import('./Retro'))
export const RetroDetail = lazy(() => import('./RetroDetail'))
export const Craft = lazy(() => import('./Craft'))
export const About = lazy(() => import('./About'))
export const NotFound = lazy(() => import('./NotFound'))

/**
 * 路由 chunk 预热。
 *
 * 存在的理由只有一个：路由切换过渡不能截到 Suspense 的空白帧。
 * 指针扫过链接时就把对应 chunk 取回来，点击时 lazy 的 thenable 已经 resolve，
 * 过渡才能截到真实内容。触摸设备没有 hover，靠 pointerover 在按下瞬间预热。
 */
const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('./Home'),
  '/me': () => import('./Me'),
  '/notes': () => import('./Notes'),
  '/notes/:slug': () => import('./NoteDetail'),
  '/local': () => import('./LocalDoc'),
  '/import': () => import('./Import'),
  '/retro': () => import('./Retro'),
  '/retro/:slug': () => import('./RetroDetail'),
  '/craft': () => import('./Craft'),
  '/about': () => import('./About'),
}

const preloaded = new Set<string>(['/'])

/** 把具体路径归一成 loader key：/notes/xxx → /notes/:slug，/notes/ → /notes */
function loaderKey(pathname: string): string {
  if (pathname.startsWith('/notes/')) return '/notes/:slug'
  // id 走 query（/local?id=xxx），所以不再是 /local/xxx 这种带段的形式；
  // 但旧地址也要能预热，否则从书签点进来会白一帧
  if (pathname.startsWith('/local')) return '/local'
  if (pathname.startsWith('/retro/')) return '/retro/:slug'
  return pathname.replace(/\/+$/, '') || '/'
}

/** 首屏已经带了 Home 的 chunk，所以 / 永远算就绪 */
export function isRoutePreloaded(pathname: string): boolean {
  return preloaded.has(loaderKey(pathname))
}

export function preloadRoute(pathname: string): Promise<void> {
  const key = loaderKey(pathname)
  const loader = routeLoaders[key]

  if (!loader || preloaded.has(key)) return Promise.resolve()

  return loader().then(
    () => {
      preloaded.add(key)
    },
    // 预热失败不记录，下次还有机会重试；导航本身不该被它拦住
    () => undefined,
  )
}
