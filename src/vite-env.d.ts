/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 留言后端地址，见 .env.example。为空时全站不渲染留言区 */
  readonly VITE_COMMENTS_API?: string
  readonly VITE_SITE_URL?: string
}

/** 构建期注入，见 vite.config.ts 的 define —— 服务端与客户端必须是同一个值 */
declare const __BUILD_DATE__: string
declare const __BUILD_TIME__: number

declare module 'virtual:content-index' {
  import type { NoteMeta, RetroMeta, TocItem } from '@/lib/content'

  interface Indexed<M> {
    slug: string
    meta: M
    toc: TocItem[]
    readingTime: number
  }

  const index: {
    notes: Indexed<NoteMeta>[]
    retro: Indexed<RetroMeta>[]
  }

  export default index
}

declare module '*.mdx' {
  import type { ComponentType, ElementType } from 'react'

  const MDXComponent: ComponentType<{ components?: Record<string, ElementType> }>
  export default MDXComponent
}
