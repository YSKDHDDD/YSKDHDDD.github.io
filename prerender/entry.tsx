import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from '@/App'
import { notes, retros } from '@/lib/content'
import { headTags, resolveMeta } from '@/lib/meta'
import { moments } from '@/lib/moments'
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

/**
 * 要生成静态 HTML 的路径。全站只有这里一处路由清单，由内容索引推导。
 *
 * `noindex` 的条目照样要产出 HTML（没有真实文件，直接访问就是 404），
 * 但会被 sitemap 跳过 —— 两者要求不同，别混成一个开关。
 */
export interface StaticPath {
  path: string
  priority: number
  changefreq: string
  /** 不写进 sitemap：页面上已经声明了 noindex，再提交给爬虫是自相矛盾 */
  noindex?: boolean
}

export function getStaticPaths(): StaticPath[] {
  return [
    { path: '/', priority: 1.0, changefreq: 'weekly' },
    { path: '/me', priority: 0.9, changefreq: 'monthly' },
    { path: '/notes', priority: 0.9, changefreq: 'weekly' },
    { path: '/retro', priority: 0.8, changefreq: 'weekly' },
    { path: '/life', priority: 0.7, changefreq: 'weekly' },
    { path: '/import', priority: 0.6, changefreq: 'monthly' },
    ...notes.map((note) => ({ path: `/notes/${note.slug}`, priority: 0.7, changefreq: 'monthly' })),
    ...retros.map((retro) => ({ path: `/retro/${retro.slug}`, priority: 0.6, changefreq: 'monthly' })),
    /*
      生活的单条记录。它们不进 RSS（那份 feed 是给「文章」的，照片不该混进去），
      但都要有真实文件：/life/xxx 直接访问落到 404.html 的话，刷新会闪一下错误页。
    */
    ...moments.map((moment) => ({ path: `/life/${moment.id}`, priority: 0.6, changefreq: 'monthly' })),
    /*
      本地文档的阅读页：id 在 query 里，所以只需要一个 /local 的真实文件。
      没有它，/local?id=xxx 会落到 404.html，状态码 404、标题「页面不存在」，
      刷新必闪一下 —— 这正是它上一版（/local/:id）的问题。
    */
    { path: '/local', priority: 0.1, changefreq: 'yearly', noindex: true },
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
