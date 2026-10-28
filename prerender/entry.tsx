import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from '@/App'
import { notes, retros } from '@/lib/content'
import { headTags, resolveMeta } from '@/lib/meta'
import { SITE } from '@/lib/site'

/**
 * 预渲染入口。
 *
 * 这里刻意复用 App 本身，而不是再写一份「静态版路由表」——
 * 两份路由一定会漂移，最后得到的是「线上页面和预渲染页面不是同一个」这种最难查的 bug。
 *
 * App 里的页面是 React.lazy 的。renderToString 不会等待 Suspense，
 * 但 renderToPipeableStream 的 onAllReady 会等所有边界 resolve 完，
 * 所以拿到的 HTML 是完整的正文，而不是一堆 loading 占位。
 */

/** 要生成静态 HTML 的路径。全站只有这里一处路由清单，由内容索引推导 */
export function getStaticPaths(): { path: string; priority: number; changefreq: string }[] {
  return [
    { path: '/', priority: 1.0, changefreq: 'weekly' },
    { path: '/notes', priority: 0.9, changefreq: 'weekly' },
    { path: '/retro', priority: 0.8, changefreq: 'weekly' },
    ...notes.map((note) => ({ path: `/notes/${note.slug}`, priority: 0.7, changefreq: 'monthly' })),
    ...retros.map((retro) => ({ path: `/retro/${retro.slug}`, priority: 0.6, changefreq: 'monthly' })),
    { path: '/craft', priority: 0.5, changefreq: 'monthly' },
    { path: '/about', priority: 0.5, changefreq: 'yearly' },
  ]
}

export interface RenderResult {
  html: string
  warnings: string[]
}

/**
 * 部署前缀：根路径部署时是空串，GitHub Pages 项目站点时是 `/仓库名`。
 *
 * 预渲染必须和客户端用同一个 basename，否则 `<Link to="/notes">` 在服务端渲染成
 * `/notes`、在浏览器渲染成 `/仓库名/notes` —— 属性对不上，React 会在 hydration
 * 时报 mismatch 并丢掉那段 DOM 重建，正好抵消掉预渲染的意义。
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '')

/** StaticRouter 会从 location 里剥掉 basename，所以要先把前缀拼上去 */
function withBase(pathname: string) {
  return `${BASE}${pathname}` || '/'
}

/** 每个页面该有的 <head> 内容。脚本拿它整段替换模板里的标题与描述 */
export function headFor(url: string): string {
  return headTags(resolveMeta(url)).replace(/\n/g, '\n    ')
}

export interface FeedEntry {
  path: string
  kind: '笔记' | '复盘'
  title: string
  summary: string
  date: string
  updated: string
  tags: string[]
}

/** RSS 与 sitemap 的数据源，和页面用同一份索引 */
export function getFeedEntries(): FeedEntry[] {
  const entries: FeedEntry[] = [
    ...notes.map((note) => ({
      path: `/notes/${note.slug}`,
      kind: '笔记' as const,
      title: note.meta.title,
      summary: note.meta.summary,
      date: note.meta.date,
      updated: note.meta.updated,
      tags: note.meta.tags,
    })),
    ...retros.map((retro) => ({
      path: `/retro/${retro.slug}`,
      kind: '复盘' as const,
      title: retro.meta.title,
      summary: retro.meta.summary,
      date: retro.meta.date,
      updated: retro.meta.updated,
      tags: retro.meta.tags,
    })),
  ]
  return entries.sort((a, b) => b.date.localeCompare(a.date))
}

/** 站点级信息，脚本写 sitemap / RSS 头时用 */
export function siteInfo() {
  return SITE
}

export function render(url: string): RenderResult {
  /**
   * 必须用同步的 renderToString，不能用 renderToPipeableStream / prerenderToNodeStream。
   *
   * 后两者是「流式首屏」的设计：一旦 Suspense 边界在调度里被判定为 pending，
   * 就会输出 `<template id="B:0">` 占位 + `<div hidden id="S:0">正文` + `$RC` 搬运脚本。
   * 浏览器执行脚本后看起来正常，但爬虫拿到的是空壳 —— 预渲染等于白做。
   *
   * 实测：同样一棵树，流式 API 在 7 个页面里 5 个分块，renderToString 全部 0 分块，
   * 且保留了 `<!--$-->` 边界注释，hydration 的结构与客户端一致。
   *
   * 这里不做错误兜底：渲染失败就让构建失败，比产出一堆残缺静态页要好。
   */
  const html = renderToString(
    <StaticRouter basename={BASE || '/'} location={withBase(url)}>
      <App />
    </StaticRouter>,
  )

  return { html, warnings: [] }
}
