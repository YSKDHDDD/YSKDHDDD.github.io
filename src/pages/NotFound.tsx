import { Link } from 'react-router-dom'
import GradientWaves from '@/components/effects/GradientWaves'

export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-[70vh] items-center overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-60">
        <GradientWaves className="h-full w-full" height={100} speed={0.3} />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/70 to-bg" />

      <div className="page-shell">
        <p className="font-mono text-label tracking-[0.14em] text-faint">404</p>
        <h1 className="mt-4 max-w-[20ch] text-h1 font-medium tracking-[-0.02em] text-fg">
          这个地址没有内容，但它有波浪
        </h1>
        <p className="mt-4 max-w-[44ch] text-body text-muted">
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
