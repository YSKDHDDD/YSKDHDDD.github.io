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
export const Notes = lazy(() => import('./Notes'))
export const NoteDetail = lazy(() => import('./NoteDetail'))
export const Retro = lazy(() => import('./Retro'))
export const RetroDetail = lazy(() => import('./RetroDetail'))
export const Craft = lazy(() => import('./Craft'))
export const About = lazy(() => import('./About'))
export const NotFound = lazy(() => import('./NotFound'))
