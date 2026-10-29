import type { NoteStatus, TopicId } from './content'

/**
 * 本地文档：用户自己拖进来的 markdown。
 *
 * 只存在这台设备的 IndexedDB 里 —— 没有账号、没有后端、没有上传接口。
 * 这一点必须写进界面文案：读者有权知道"我拖进来的东西去哪了"，
 * 而"什么都不发生"是最难让人相信的一种隐私承诺。
 */
export interface LocalDoc {
  id: string
  title: string
  date: string
  updated: string
  topic: TopicId
  tags: string[]
  status: NoteStatus
  summary: string
  /**
   * 摘要的出处。
   *
   * `body` 表示这是从正文首段截的 —— 阅读页靠它决定要不要显示摘要：
   * 首段在正文里本来就会出现一次，页头再放一遍就是同一句话读两次。
   * 列表页不分这两种，那里看不到正文，摘要必须显示。
   */
  summaryFrom: 'meta' | 'body'
  /** 原始 markdown，渲染推迟到打开时再做 */
  body: string
  fileName: string
  size: number
  importedAt: number
}

const DB_NAME = 'exoself'
const DB_VERSION = 1
const STORE = 'docs'

const TOPICS: TopicId[] = ['engineering', 'design', 'tooling', 'misc']
const STATUSES: NoteStatus[] = ['seedling', 'growing', 'evergreen']

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => db.close()
      }),
  )
}

export async function listLocalDocs(): Promise<LocalDoc[]> {
  if (!hasIndexedDb()) return []
  try {
    const docs = await tx<LocalDoc[]>('readonly', (store) => store.getAll())
    return docs.sort((a, b) => b.importedAt - a.importedAt)
  } catch {
    // 隐私模式或存储被禁用：当作"没有本地文档"，不要让整个页面挂掉
    return []
  }
}

export async function putLocalDoc(doc: LocalDoc): Promise<void> {
  if (!hasIndexedDb()) throw new Error('这个浏览器不支持本地存储')
  await tx('readwrite', (store) => store.put(doc))
}

/**
 * 只改元数据，不动正文。
 *
 * 导入时主题只能靠 frontmatter 猜，猜错了不该逼用户删掉重导 ——
 * 重导会换掉 importedAt，列表顺序也跟着变，一次分类调整就变成一次搬家。
 */
export async function updateLocalDocMeta(
  id: string,
  patch: Partial<Pick<LocalDoc, 'topic' | 'tags' | 'status'>>,
): Promise<LocalDoc | null> {
  if (!hasIndexedDb()) return null
  const current = await tx<LocalDoc | undefined>('readonly', (store) => store.get(id))
  if (!current) return null
  const next: LocalDoc = { ...current, ...patch }
  // readwrite 事务不能跨 await 复用，所以重新开一次
  await tx('readwrite', (store) => store.put(next))
  return next
}

export async function deleteLocalDoc(id: string): Promise<void> {
  if (!hasIndexedDb()) return
  await tx('readwrite', (store) => store.delete(id))
}

/** 同一篇文章重复导入时覆盖旧的，避免列表里堆出两份一模一样的 */
export function docIdFor(fileName: string, body: string): string {
  let hash = 2166136261
  const seed = `${fileName}:${body.length}:${body.slice(0, 400)}`
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `local-${(hash >>> 0).toString(36)}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseList(value: string): string[] {
  return value
    .replace(/^\[|\]$/g, '')
    .split(/[,，]/)
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .slice(0, 6)
}

interface Frontmatter {
  data: Record<string, string>
  body: string
}

function parseFrontmatter(source: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (!match) return { data: {}, body: source }

  const data: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line.trim())
    if (!pair) continue
    const value = pair[2].trim().replace(/^['"]|['"]$/g, '')
    if (value) data[pair[1]] = value
  }
  return { data, body: source.slice(match[0].length) }
}

function firstHeading(body: string): string | null {
  const match = /^#\s+(.+)$/m.exec(body)
  return match ? match[1].replace(/[*_`~]/g, '').trim() : null
}

function firstParagraph(body: string): string {
  const blocks = body.split(/\r?\n\s*\r?\n/)
  for (const block of blocks) {
    const text = block.trim()
    if (!text || /^(#|>|```|\||-{3,}|\s*[-*+]\s|\s*\d+[.)]\s)/.test(text)) continue
    const clean = text
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (clean) return clean
  }
  return ''
}

export interface ParseResult {
  doc: LocalDoc
  /** 前端件里有没有 frontmatter，用来在界面上标注"字段来自文件头" */
  hasFrontmatter: boolean
  warnings: string[]
}

/** 把一段文本变成一个可入库的文档。缺字段全部有合理默认值，不因为缺 frontmatter 就拒收 */
export function parseDocText(text: string, fileName: string): ParseResult {
  const { data, body } = parseFrontmatter(text)
  const warnings: string[] = []

  const heading = firstHeading(body)
  const title = data.title || heading || fileName.replace(/\.[^.]+$/, '')
  if (!data.title && !heading) warnings.push('没有标题，用文件名代替')

  const date = /^\d{4}-\d{2}-\d{2}$/.test(data.date ?? '') ? data.date : today()
  if (data.date && date !== data.date) warnings.push('日期格式不对，已用今天')

  /*
    没写主题就归「未分类」，不归「工程」。
    前者是诚实的"还不知道"，后者会让工程的计数凭空变大 —— 一篇读书笔记
    拉高工程分类的数字，筛选出来的人会以为站里多了一篇工程笔记。
  */
  const topic = TOPICS.includes(data.topic as TopicId) ? (data.topic as TopicId) : 'misc'
  if (data.topic && topic !== data.topic) warnings.push('主题不在列表里，先归到「未分类」')

  const status = STATUSES.includes(data.status as NoteStatus)
    ? (data.status as NoteStatus)
    : 'seedling'

  const summary = (data.summary || firstParagraph(body) || '（这篇文档没有正文摘要）').slice(0, 90)

  const doc: LocalDoc = {
    id: docIdFor(fileName, body),
    title: title.slice(0, 120),
    date,
    updated: /^\d{4}-\d{2}-\d{2}$/.test(data.updated ?? '') ? data.updated : date,
    topic,
    tags: parseList(data.tags ?? ''),
    status,
    summary,
    summaryFrom: data.summary ? 'meta' : 'body',
    body,
    fileName,
    size: new Blob([text]).size,
    importedAt: Date.now(),
  }

  return { doc, hasFrontmatter: Object.keys(data).length > 0, warnings }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
