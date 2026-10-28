import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * 预渲染：把 SPA 变回静态站。
 *
 * 顺序很重要：dist/index.html 是 Vite 生成的模板（带正确的 script/link 标签和哈希文件名），
 * 我们只替换 <head> 里的元信息，再把渲染结果塞进 #root。
 * 这样静态产物和客户端 hydration 拿到的是同一棵 DOM 树，不会闪烁也不会报 mismatch。
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ssrDir = path.join(root, 'dist-ssr')

const templatePath = path.join(dist, 'index.html')
if (!fs.existsSync(templatePath)) {
  console.error('找不到 dist/index.html —— 先跑 vite build')
  process.exit(1)
}
if (!fs.existsSync(path.join(ssrDir, 'entry.js'))) {
  console.error('找不到 dist-ssr/entry.js —— 先跑 vite build --ssr')
  process.exit(1)
}

const template = fs.readFileSync(templatePath, 'utf8')
const app = await import(pathToFileURL(path.join(ssrDir, 'entry.js')).href)

const site = app.siteInfo()
const routes = app.getStaticPaths()
const feed = app.getFeedEntries()

const ROOT_SLOT = '<div id="root"></div>'
const HEAD_RE = /<title>[\s\S]*?<\/title>\s*<meta\s+name="description"[\s\S]*?\/>/

if (!template.includes(ROOT_SLOT)) {
  console.error('模板里找不到 <div id="root"></div>，无法注入')
  process.exit(1)
}
if (!HEAD_RE.test(template)) {
  console.error('模板里找不到 title + description，无法替换 head')
  process.exit(1)
}

const written = []
let warned = 0

for (const route of routes) {
  const { html, warnings } = await app.render(route.path)

  /**
   * 两个都不能出现的信号：
   * - `<template id="B:` / `<div hidden id="S:` 是流式 SSR 的分块结构，说明有 Suspense 没解析；
   * - `aria-busy` 是 SiteLayout 的骨架，出现即意味着主体是空的。
   * 这类问题不会报错，只会安静地产出"看起来有、其实没有"的静态页，必须在这里拦住。
   */
  if (html.includes('<template id="B:') || html.includes('<div hidden id="S:')) {
    console.error(`✗ ${route.path} 渲染结果含 Suspense 占位块（有懒加载没解析），静态 HTML 里没有正文`)
    process.exit(1)
  }
  if (html.includes('aria-busy="true"')) {
    console.error(`✗ ${route.path} 渲染结果仍是骨架 fallback`)
    process.exit(1)
  }

  // 预渲染最容易出的另一个问题是「生成了，但内容是空的」
  const textLength = html.replace(/<[^>]+>/g, '').trim().length
  if (textLength < 200) {
    console.error(`✗ ${route.path} 渲染出的正文只有 ${textLength} 字符，疑似空页`)
    process.exit(1)
  }

  if (warnings.length) {
    warned += warnings.length
    console.warn(`  ! ${route.path} 有 ${warnings.length} 条渲染警告：${warnings[0]}`)
  }

  const page = template
    .replace(HEAD_RE, () => app.headFor(route.path))
    .replace(ROOT_SLOT, () => `<div id="root">${html}</div>`)

  const target =
    route.path === '/'
      ? path.join(dist, 'index.html')
      : path.join(dist, route.path.replace(/^\//, ''), 'index.html')

  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, page)
  written.push({ path: route.path, size: page.length, text: textLength })
}

// 托管平台（Netlify / Cloudflare Pages / GitHub Pages）认这个文件接管未知路径
const notFound = await app.render('/404')
fs.writeFileSync(
  path.join(dist, '404.html'),
  template
    .replace(HEAD_RE, () => app.headFor('/404'))
    .replace(ROOT_SLOT, () => `<div id="root">${notFound.html}</div>`),
)

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** 与 src/lib/site.ts 的 absoluteUrl 保持一致：目录式路由的最终地址带尾斜杠 */
const pageUrl = (pathname) => {
  const clean = pathname.replace(/\/+$/, '')
  return `${site.url}${clean ? `${clean}/` : '/'}`
}

const newest = feed[0]

// ---------- sitemap ----------
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map((route) => {
    const entry = feed.find((item) => item.path === route.path)
    const lastmod = entry?.updated ?? newest?.updated
    return [
      '  <url>',
      `    <loc>${esc(pageUrl(route.path))}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority.toFixed(1)}</priority>`,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n')
  }),
  '</urlset>',
  '',
].join('\n')

// ---------- RSS ----------
const rss = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  '  <channel>',
  `    <title>${esc(site.name)}</title>`,
  `    <link>${esc(site.url)}</link>`,
  `    <description>${esc(site.description)}</description>`,
  `    <language>${site.locale}</language>`,
  `    <lastBuildDate>${new Date(`${newest?.updated ?? '2026-01-01'}T00:00:00Z`).toUTCString()}</lastBuildDate>`,
  `    <atom:link href="${esc(`${site.url}/rss.xml`)}" rel="self" type="application/rss+xml" />`,
  ...feed.map((item) =>
    [
      '    <item>',
      `      <title>${esc(item.title)}</title>`,
      `      <link>${esc(pageUrl(item.path))}</link>`,
      `      <guid isPermaLink="true">${esc(pageUrl(item.path))}</guid>`,
      `      <description>${esc(item.summary)}</description>`,
      `      <pubDate>${new Date(`${item.date}T00:00:00Z`).toUTCString()}</pubDate>`,
      `      <category>${esc(item.kind)}</category>`,
      ...item.tags.map((tag) => `      <category>${esc(tag)}</category>`),
      '    </item>',
    ].join('\n'),
  ),
  '  </channel>',
  '</rss>',
  '',
].join('\n')

// ---------- robots ----------
const robots = ['User-agent: *', 'Allow: /', '', `Sitemap: ${site.url}/sitemap.xml`, ''].join('\n')

fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap)
fs.writeFileSync(path.join(dist, 'rss.xml'), rss)
fs.writeFileSync(path.join(dist, 'robots.txt'), robots)

// ---------- 报告 ----------
console.log(`\n预渲染完成：${written.length} 个页面 + 404.html`)
console.log(
  `  正文最少 ${Math.min(...written.map((w) => w.text))} 字符，最多 ${Math.max(...written.map((w) => w.text))} 字符`,
)
console.log(`  sitemap.xml/${feed.length} 条 · rss.xml/${feed.length} 条 · robots.txt`)
if (warned) console.log(`  ${warned} 条渲染警告（见上）`)

// sitemap 里的域名写错是最常见的上线事故：链接全是 localhost，爬虫一条都进不来
if (!site.isConfigured) {
  console.warn(
    '\n⚠ 没有设置 VITE_SITE_URL，canonical / sitemap / RSS 里写的是 localhost。\n' +
      '  部署前请设置它，例如：VITE_SITE_URL=https://your-domain.com npm run build\n',
  )
}
