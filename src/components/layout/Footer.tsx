import { Link } from 'react-router-dom'
import { notes, retros } from '@/lib/content'
import { navLinks } from '@/lib/nav'

// 构建期常量（vite define 注入）：浏览器运行时不重新求值，避免与预渲染结果不一致
const buildDate = __BUILD_DATE__

/**
 * 原生 <a> 不经过路由，拿不到 basename，必须自己带上部署前缀。
 * BASE_URL 带尾斜杠，直接拼文件名即可。
 */
const BASE = import.meta.env.BASE_URL

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="page-shell flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-meta text-muted">
            学习外脑 · 把技术笔记和项目复盘放在同一个地方
          </p>
          <p className="font-mono text-label text-faint">
            {notes.length} 篇笔记 · {retros.length} 个复盘 · 构建于 {buildDate}
          </p>
        </div>

        <nav aria-label="页脚导航" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-meta">
          {/* 顺序来自 navLinks，和顶栏是同一份，别再在这里手写一遍 */}
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-muted transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
          <a href={`${BASE}rss.xml`} className="text-faint transition-colors hover:text-fg">
            RSS
          </a>
        </nav>
      </div>
    </footer>
  )
}
