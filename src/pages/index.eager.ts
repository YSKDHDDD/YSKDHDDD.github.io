/**
 * 页面组件的同步版本 —— 只在预渲染构建里通过 alias 生效，永远不会进浏览器包。
 */
export { default as Home } from './Home'
export { default as Me } from './Me'
export { default as Notes } from './Notes'
export { default as NoteDetail } from './NoteDetail'
export { default as LocalDoc } from './LocalDoc'
export { default as ImportPage } from './Import'
export { default as Retro } from './Retro'
export { default as RetroDetail } from './RetroDetail'
export { default as Life } from './Life'
export { default as Craft } from './Craft'
export { default as About } from './About'
export { default as NotFound } from './NotFound'

/**
 * 预渲染路径上所有页面都已经同步加载，预热没有意义。
 * 保留同名导出只是为了让 SiteLayout 不必区分两种构建。
 */
export function isRoutePreloaded(): boolean {
  return true
}

export function preloadRoute(): Promise<void> {
  return Promise.resolve()
}
