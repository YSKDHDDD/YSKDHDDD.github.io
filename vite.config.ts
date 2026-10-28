import fs from 'node:fs'
import path from 'node:path'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * frontmatter 的结构是我们自己定的，只需要支持三种形态：
 * `key: value`、`key: [a, b]`、`key: [{...}]`。
 * 少一个解析库，就少一个构建期失败点。
 */
function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!match) return { data: {}, body: raw }

  const data: Record<string, unknown> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colon = line.indexOf(':')
    if (colon === -1) continue

    const key = line.slice(0, colon).trim()
    const rawValue = line.slice(colon + 1).trim()
    if (!rawValue) continue

    if (rawValue.startsWith('[')) {
      try {
        data[key] = JSON.parse(rawValue)
      } catch {
        data[key] = rawValue
          .slice(1, -1)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      }
    } else if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      data[key] = rawValue.slice(1, -1)
    } else {
      data[key] = rawValue
    }
  }

  return { data, body: raw.slice(match[0].length) }
}

/** 与 github-slugger 对齐，保证 TOC 锚点和 rehype-slug 生成的 id 一致 */
function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

function stripFences(body: string) {
  return body.replace(/^```[\s\S]*?^```/gm, '')
}

function extractToc(body: string) {
  const toc: { depth: number; text: string; id: string }[] = []

  for (const line of stripFences(body).split(/\r?\n/)) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (!match) continue
    const text = match[2]
      .replace(/`/g, '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    toc.push({ depth: match[1].length, text, id: slugify(text) })
  }

  return toc
}

/** 中文按字计、西文按词计，比数空格更接近真实阅读时长 */
function estimateReadingTime(body: string) {
  const cjk = (body.match(/[\u4e00-\u9fa5]/g) ?? []).length
  const words = (body.match(/[a-zA-Z0-9]+/g) ?? []).length
  return Math.max(1, Math.round(cjk / 350 + words / 220))
}

const CONTENT_DIRS = {
  notes: 'content/notes',
  retro: 'content/retro',
} as const

const VIRTUAL_ID = 'virtual:content-index'
const RESOLVED_ID = '\0' + VIRTUAL_ID

/**
 * 内容索引：构建期把 frontmatter / TOC / 阅读时长算好，导出成一个纯 JSON 模块。
 *
 * 这样列表页只需要这份索引（几 KB），正文组件走 import.meta.glob 的懒加载，
 * 首屏不会把所有文章打进来。
 */
function contentIndex(): Plugin {
  const root = import.meta.dirname

  const readIndex = () => {
    const index: Record<string, unknown[]> = {}

    for (const [key, dir] of Object.entries(CONTENT_DIRS)) {
      const absolute = path.resolve(root, dir)
      if (!fs.existsSync(absolute)) {
        index[key] = []
        continue
      }

      index[key] = fs
        .readdirSync(absolute)
        .filter((file) => file.endsWith('.mdx'))
        .map((file) => {
          const raw = fs.readFileSync(path.join(absolute, file), 'utf8')
          const { data, body } = parseFrontmatter(raw)
          return {
            slug: file.replace(/\.mdx$/, ''),
            meta: data,
            toc: extractToc(body),
            readingTime: estimateReadingTime(body),
          }
        })
        .sort((a, b) => String(b.meta.date).localeCompare(String(a.meta.date)))
    }

    return index
  }

  return {
    name: 'content-index',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      return `export default ${JSON.stringify(readIndex())}`
    },
    configureServer(server) {
      const invalidate = (file: string) => {
        if (!file.includes(`${path.sep}content${path.sep}`)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', invalidate)
      server.watcher.on('change', invalidate)
      server.watcher.on('unlink', invalidate)
    },
  }
}

/**
 * Vite 的 base 要求「以 / 开头、以 / 结尾」，而注入进来的值可能两头都不带。
 * 空值统一成 '/'：`//` 在 HTML 里会被当成协议相对地址，指向 `https://仓库名/`。
 */
function normalizeBase(raw: string | undefined) {
  const trimmed = (raw ?? '').replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

export default defineConfig(({ mode }) => {
  /**
   * 站点不一定在域名根路径下：GitHub Pages 的项目站点是
   * `https://用户名.github.io/仓库名/`，资源路径少一段前缀就整站 404。
   *
   * 由 CI 注入（actions/configure-pages 的 base_path），本地默认根路径。
   * 必须是绝对路径而不是 './'：预渲染会把 dist/index.html 复制到子目录，
   * 相对路径在 `/notes/xxx/` 下会解析成 `/notes/xxx/assets/...`。
   *
   * 必须走 loadEnv 而不是 process.env：Vite 只把 .env 文件注入到客户端的
   * import.meta.env，不会写进配置文件进程的 process.env —— 直接读会永远拿到 undefined，
   * 表现为「配了 VITE_BASE 但构建产物还是根路径」，而且没有任何报错。
   * loadEnv 会合并 .env 文件与已有的 process.env（后者优先），两种来源都覆盖。
   */
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const base = normalizeBase(env.VITE_BASE)

  /**
   * 预渲染时把「懒加载实现」换成「同步实现」。
   *
   * 原因：只要渲染路径上有 React.lazy，流式 SSR 就会把整页输出成
   * `<template id="B:0">` 占位 + `<div hidden id="S:0">正文` + 内联 `$RC` 脚本。
   * 浏览器会把它拼回去，但爬虫不会 —— 那等于什么都没预渲染。
   *
   * 换成同步组件后 shell 本身就是完整内容，不需要搬运脚本。
   * 这两个 alias 只在 `vite build --ssr --mode ssr` 生效，浏览器包仍然按篇懒加载。
   *
   * 用 mode 而不是 isSsrBuild 判断：后者在不同 Vite 版本里参数名不稳定，
   * 一旦判断失误，构建会成功但产物退化成"分块 SSR"，而且没有报错——很难发现。
   */
  const isPrerender = mode === 'ssr'
  const eagerAlias = isPrerender
    ? [
        { find: /^@\/pages$/, replacement: path.resolve(import.meta.dirname, 'src/pages/index.eager.ts') },
        { find: /^@\/lib\/bodies$/, replacement: path.resolve(import.meta.dirname, 'src/lib/bodies.eager.ts') },
      ]
    : []

  return {
    base,
    /**
     * 构建时刻必须在构建期就固化成常量。
     *
     * 这几处原本是模块作用域的 `new Date()`：预渲染时算一次，浏览器加载 JS 时又算一次，
     * 于是「构建于 X 日」「本月新增 N 篇」「最近更新 N 天前」在两边可能不一样，
     * React 会报 hydration mismatch 并把那段 DOM 丢掉重渲染。
     *
     * 注入成常量后，服务端和客户端拿到的是同一个值 —— 语义上也更准确：
     * 它说的本来就该是「这份产物是什么时候构建的」。
     */
    define: {
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
      __BUILD_TIME__: JSON.stringify(Date.now()),
    },
    plugins: [
      contentIndex(),
      mdx({
        remarkPlugins: [remarkFrontmatter, remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap', properties: { className: ['anchor'] } }],
          [
            rehypePrettyCode,
            {
              // 双主题：颜色写进 --shiki-dark / --shiki-light，由 CSS 按当前主题取用
              theme: { dark: 'github-dark-default', light: 'github-light-default' },
              keepBackground: false,
              defaultLang: { block: 'text', inline: 'text' },
            },
          ],
        ],
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: [...eagerAlias, { find: '@', replacement: path.resolve(import.meta.dirname, 'src') }],
    },
  }
})
