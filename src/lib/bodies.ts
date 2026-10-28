import { lazy, type ComponentType, type ElementType } from 'react'

export type MDXContent = ComponentType<{ components?: Record<string, ElementType> }>

type ContentLoader = () => Promise<{ default: MDXContent }>

const noteLoaders = import.meta.glob('/content/notes/*.mdx') as Record<string, ContentLoader>
const retroLoaders = import.meta.glob('/content/retro/*.mdx') as Record<string, ContentLoader>

/**
 * 正文按需加载：列表页永远不下载文章内容。
 * 组件在模块作用域就建好 —— 在 render 里调 lazy() 会每次重新创建组件、丢掉状态。
 */
function buildComponents(loaders: Record<string, ContentLoader>): Record<string, MDXContent> {
  const map: Record<string, MDXContent> = {}
  for (const [path, loader] of Object.entries(loaders)) {
    map[path.split('/').pop()!.replace(/\.mdx$/, '')] = lazy(loader)
  }
  return map
}

export const noteContent = buildComponents(noteLoaders)
export const retroContent = buildComponents(retroLoaders)
