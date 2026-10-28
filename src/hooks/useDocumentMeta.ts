import { useEffect } from 'react'
import { resolveMeta, type PageMeta } from '@/lib/meta'

const MANAGED = 'data-managed-head'

function clearManaged() {
  for (const node of document.head.querySelectorAll(`[${MANAGED}]`)) {
    node.remove()
  }
}

function appendMeta(attr: 'name' | 'property', key: string, content: string) {
  const el = document.createElement('meta')
  el.setAttribute(attr, key)
  el.setAttribute('content', content)
  el.setAttribute(MANAGED, '')
  document.head.appendChild(el)
}

function applyMeta(meta: PageMeta) {
  document.title = meta.title

  // 预渲染时这些标签已经写死在 HTML 里了。导航后统一重建，
  // 避免上一篇的 article:tag 残留到下一篇。
  clearManaged()

  appendMeta('name', 'description', meta.description)
  appendMeta('property', 'og:type', meta.type)
  appendMeta('property', 'og:title', meta.title)
  appendMeta('property', 'og:description', meta.description)
  appendMeta('property', 'og:url', meta.canonical)
  appendMeta('name', 'twitter:title', meta.title)
  appendMeta('name', 'twitter:description', meta.description)

  if (meta.type === 'article') {
    if (meta.published) appendMeta('property', 'article:published_time', meta.published)
    if (meta.modified) appendMeta('property', 'article:modified_time', meta.modified)
    for (const tag of meta.tags ?? []) appendMeta('property', 'article:tag', tag)
  }

  if (meta.noindex) appendMeta('name', 'robots', 'noindex')

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    canonical.setAttribute(MANAGED, '')
    document.head.appendChild(canonical)
  }
  canonical.href = meta.canonical
}

/**
 * 浏览器标签页标题在 SPA 里最容易漏掉 —— 不接这个，翻完整站所有页面标题都一样。
 * 只依赖 pathname，和路由切换同一节奏。
 */
export function useDocumentMeta(pathname: string) {
  useEffect(() => {
    applyMeta(resolveMeta(pathname))
  }, [pathname])
}
