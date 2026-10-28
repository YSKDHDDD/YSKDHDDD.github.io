import type { ComponentType, ElementType } from 'react'

export type MDXContent = ComponentType<{ components?: Record<string, ElementType> }>

/**
 * 预渲染专用：正文组件同步就位。
 *
 * 静态站要求 HTML 里直接带正文，所以 SSR 构建里不能有任何 lazy 边界。
 * 这个文件只在 `vite build --ssr` 时通过 vite.config.ts 的 alias 替换掉 bodies.ts，
 * 浏览器包永远是懒加载版本。
 */
const noteModules = import.meta.glob('/content/notes/*.mdx', {
  eager: true,
  import: 'default',
}) as Record<string, MDXContent>

const retroModules = import.meta.glob('/content/retro/*.mdx', {
  eager: true,
  import: 'default',
}) as Record<string, MDXContent>

function toSlugMap(modules: Record<string, MDXContent>): Record<string, MDXContent> {
  const map: Record<string, MDXContent> = {}
  for (const [path, Component] of Object.entries(modules)) {
    map[path.split('/').pop()!.replace(/\.mdx$/, '')] = Component
  }
  return map
}

export const noteContent = toSlugMap(noteModules)
export const retroContent = toSlugMap(retroModules)
