/**
 * 站点级常量。
 *
 * `url` 必须能在构建期拿到 —— 预渲染要写 canonical、sitemap 和 RSS 里的绝对地址，
 * 这些文件是静态的，浏览器没法替我们补域名。所以走 VITE_SITE_URL，
 * 本地开发时回退到一个显式的占位值，避免悄悄生成 localhost 的产物。
 */
const rawUrl = import.meta.env.VITE_SITE_URL

export const SITE = {
  name: '学习外脑',
  tagline: '技术笔记与项目复盘',
  description:
    '一个把技术笔记和项目复盘长期沉淀下来的个人外脑：关注代码可读性与可维护性，也用界面细节证明工程审美。',
  /** 结尾不带斜杠，拼路径时统一自己加 */
  url: (rawUrl ?? 'http://localhost:5173').replace(/\/+$/, ''),
  locale: 'zh-CN',
  author: '本站作者',
  /** 预渲染时用它判断要不要在 stderr 提示「还没配置真实域名」 */
  isConfigured: Boolean(rawUrl),
} as const

/**
 * 页面最终地址。
 *
 * 静态托管按目录出文件（`dist/notes/xxx/index.html`），所以真实 URL 带尾斜杠，
 * 不带斜杠的请求会被 301 过来。canonical / sitemap / RSS 里必须写最终地址，
 * 否则搜索引擎拿到的是「需要跳转的 URL」，白白损失一点权重。
 */
export function absoluteUrl(pathname: string) {
  const clean = pathname.replace(/\/+$/, '')
  return `${SITE.url}${clean ? `${clean}/` : '/'}`
}
