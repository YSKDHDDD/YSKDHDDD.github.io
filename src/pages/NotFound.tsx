import { Link } from 'react-router-dom'
import GradientWaves from '@/components/effects/GradientWaves'
import './NotFound.css'

export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-[70vh] items-center overflow-hidden">
      {/* 这里不套 opacity-60：透明度已经在组件里按主题算过，外面再乘一次正是浅色下看不见的原因之一 */}
      <div className="absolute inset-0 -z-10">
        <GradientWaves className="h-full w-full" speed={0.3} amplitude={10} />
      </div>
      {/* 压一层底色给正文让位。深浅两套的厚度不同，见 NotFound.css */}
      <div className="notfound-veil absolute inset-0 -z-10" />

      <div className="page-shell">
        <p className="font-mono text-label tracking-[0.14em] text-faint">404</p>
        <h1 className="mt-4 max-w-[20ch] text-h1 font-medium tracking-[-0.02em] text-fg">
          这个地址没有内容，但它有波浪
        </h1>
        <p className="mt-4 max-w-[58ch] text-body text-muted">
          页面可能被改过名，也可能只是我还没写完。这里唯一的常驻动效就是背景 —— 因为你不会在这页久留。
        </p>
        <div className="mt-8 flex flex-wrap gap-4 text-meta">
          <Link to="/" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-brand">
            回到首页
          </Link>
          <Link to="/notes" className="text-muted transition-colors hover:text-fg">
            浏览笔记
          </Link>
        </div>
      </div>
    </div>
  )
}
