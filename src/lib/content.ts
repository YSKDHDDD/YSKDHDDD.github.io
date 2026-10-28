import contentIndex from 'virtual:content-index'

/**
 * 正文组件来自 bodies 模块：浏览器拿懒加载版本，预渲染构建时同一个 import 会被
 * vite.config.ts alias 到同步版本。上层代码不需要知道这个区别。
 */
export type { MDXContent } from '@/lib/bodies'
export { noteContent, retroContent } from '@/lib/bodies'

/** 成熟度是这套外脑的灵魂字段：它让"长期维护"这件事变得可见 */
export type NoteStatus = 'seedling' | 'growing' | 'evergreen'
export type TopicId = 'engineering' | 'design' | 'tooling' | 'reading'

export interface TocItem {
  depth: number
  text: string
  id: string
}

export interface Metric {
  label: string
  before: string
  after: string
}

export interface CommonMeta {
  title: string
  date: string
  updated: string
  topic: TopicId
  tags: string[]
  status: NoteStatus
  summary: string
}

export type NoteMeta = CommonMeta

export interface RetroMeta extends CommonMeta {
  period: string
  role: string
  stack: string[]
  metrics: Metric[]
}

export interface Entry<M> {
  slug: string
  meta: M
  toc: TocItem[]
  readingTime: number
}

export type NoteEntry = Entry<NoteMeta>
export type RetroEntry = Entry<RetroMeta>

/** 索引来自构建期的虚拟模块，体积只有几 KB，不含任何正文 */
export const notes: NoteEntry[] = contentIndex.notes
export const retros: RetroEntry[] = contentIndex.retro

export function getNote(slug: string) {
  return notes.find((note) => note.slug === slug)
}

export function getRetro(slug: string) {
  return retros.find((retro) => retro.slug === slug)
}

/** 上一篇 / 下一篇按时间倒序数组定位，语义是"更新的 / 更早的" */
export function getNoteNeighbours(slug: string) {
  const index = notes.findIndex((note) => note.slug === slug)
  return {
    newer: index > 0 ? notes[index - 1] : undefined,
    older: index >= 0 && index < notes.length - 1 ? notes[index + 1] : undefined,
  }
}

export const topicLabels: Record<TopicId, string> = {
  engineering: '工程',
  design: '设计',
  tooling: '工具链',
  reading: '阅读',
}

export const statusLabels: Record<NoteStatus, string> = {
  seedling: '萌芽',
  growing: '成长中',
  evergreen: '常青',
}

export const statusHints: Record<NoteStatus, string> = {
  seedling: '刚记下，结论可能变',
  growing: '结构成型，还在补证据',
  evergreen: '结论稳定，会持续修订',
}

export function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${year}.${month}.${day}`
}

export function topicsOf(entries: Entry<CommonMeta>[]) {
  const counts = new Map<TopicId, number>()
  for (const entry of entries) {
    counts.set(entry.meta.topic, (counts.get(entry.meta.topic) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

export interface SearchItem {
  id: string
  title: string
  summary: string
  href: string
  group: '笔记' | '复盘'
  tags: string[]
}

export const searchIndex: SearchItem[] = [
  ...notes.map((note) => ({
    id: note.slug,
    title: note.meta.title,
    summary: note.meta.summary,
    href: `/notes/${note.slug}`,
    group: '笔记' as const,
    tags: note.meta.tags,
  })),
  ...retros.map((retro) => ({
    id: retro.slug,
    title: retro.meta.title,
    summary: retro.meta.summary,
    href: `/retro/${retro.slug}`,
    group: '复盘' as const,
    tags: retro.meta.tags,
  })),
]

/** 首页「现在」这一段的数据是真的，不是占位符 */
export const nowItems = [
  {
    label: '正在读',
    title: '《Refactoring UI》',
    detail: '第 6 章：层级与留白。抄了 4 条规则进设计令牌。',
  },
  {
    label: '正在写',
    title: '中文长文的行宽推导',
    detail: '680px 不是审美选择，是每行 34–38 字的计算结果。',
  },
  {
    label: '正在搭',
    title: '本站的内容管线',
    detail: 'MDX 在构建期抽 TOC 与阅读时长，正文按篇懒加载。',
  },
]
