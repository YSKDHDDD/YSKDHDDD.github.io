import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** 站内链接走路由跳转，外链自动加 rel —— 正文里的链接不该触发整页刷新 */
export function MDXLink({ href = '', children, ...rest }: ComponentPropsWithoutRef<'a'>) {
  if (href.startsWith('/')) {
    return <Link to={href}>{children}</Link>
  }
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" {...rest}>
      {children}
    </a>
  )
}

/** 表格在窄屏会撑破布局，这里给一个横向滚动容器 */
export function MDXTable({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 my-6 overflow-x-auto px-1">
      <table>{children}</table>
    </div>
  )
}

