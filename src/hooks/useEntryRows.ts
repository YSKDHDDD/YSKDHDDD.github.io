import { useMemo } from 'react'
import { useLocalDocs } from '@/hooks/useLocalDocs'
import { estimateReadingTime } from '@/lib/markdown'
import { notes, retros } from '@/lib/content'
import type { CommonMeta, Entry } from '@/lib/content'

/** 一条内容从哪来：站内笔记、站内复盘，还是这台设备导入的 markdown */
export type EntryKind = '笔记' | '复盘'

/**
 * 列表里的一行：站内内容和本地文档走同一套渲染，只差在自己带来的 href 与标记。
 *
 * 本地文档的 meta 是从 IndexedDB 里现读的，它的日期可能比站内任何一篇都新，
 * 所以两边合并后要重新排一次序 —— 否则"刚导入的那篇"会掉到列表最底下。
 */
export type EntryRow = Entry<CommonMeta> & {
  href: string
  kind: EntryKind
  local: boolean
}

/**
 * 笔记库与归档页共用的一份行数据。
 *
 * 抽出来不是为了少写几行：两个页面各算一次，"共 N 篇"就会开始对不上 ——
 * 归档页说 21 篇、笔记库说 23 篇，用户第一反应是站点坏了，而不是"它俩统计口径不同"。
 *
 * `withRetros` 是两者唯一的差别：笔记库只管笔记（它要按主题和成熟度筛），
 * 归档页要的是"所有产出"，复盘也算一条。
 */
export function useEntryRows({ withRetros = false }: { withRetros?: boolean } = {}): EntryRow[] {
  const { docs: localDocs } = useLocalDocs()

  /*
    本地文档在 hydration 之后才出现：初始 [] 让服务端与首帧客户端算出同一棵树，
    读到 IndexedDB 再 set —— 否则预渲染的 6 篇和浏览器的 8 篇会对不上。
  */
  return useMemo<EntryRow[]>(() => {
    const builtin: EntryRow[] = notes.map((note) => ({
      ...note,
      href: `/notes/${note.slug}`,
      kind: '笔记',
      local: false,
    }))
    const retroRows: EntryRow[] = withRetros
      ? retros.map((retro) => ({
          ...retro,
          href: `/retro/${retro.slug}`,
          kind: '复盘',
          local: false,
        }))
      : []
    const local: EntryRow[] = localDocs.map((doc) => ({
      slug: doc.id,
      href: `/local?id=${doc.id}`,
      kind: '笔记',
      local: true,
      meta: {
        title: doc.title,
        date: doc.date,
        updated: doc.updated,
        topic: doc.topic,
        tags: doc.tags,
        status: doc.status,
        summary: doc.summary,
      },
      toc: [],
      readingTime: estimateReadingTime(doc.body),
    }))
    return [...builtin, ...retroRows, ...local].sort((a, b) =>
      a.meta.date === b.meta.date
        ? Number(b.local) - Number(a.local)
        : a.meta.date < b.meta.date
          ? 1
          : -1,
    )
  }, [localDocs, withRetros])
}
