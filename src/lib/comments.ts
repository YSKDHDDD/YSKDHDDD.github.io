/**
 * 留言的前端数据层。
 *
 * 后端地址来自 VITE_COMMENTS_API。没配就是 commentsEnabled === false，
 * 所有留言组件整体不渲染 —— 线上不会出现一个永远「加载中」的空框，
 * 也不会因为 fetch 404 在控制台刷红。部署 Worker 之后填上地址重新构建即可。
 *
 * 身份分两种：登录用户（Authorization: Bearer）和匿名用户（X-Client-Id，
 * 一个存在 localStorage 里的 UUID）。服务端只拿后者判断「这条是不是你写的」，
 * 不认人、不关联任何账号。
 */

export type CommentScope = 'post' | 'guest'

export type CommentProvider = 'anon' | 'github'

export interface CommentAuthor {
  name: string
  url: string | null
  provider: CommentProvider
}

export interface Comment {
  id: string
  author: CommentAuthor
  body: string
  createdAt: number
  mine: boolean
}

export interface CommentPage {
  items: Comment[]
  total: number
  next: number | null
}

export interface CommentConfig {
  auth: boolean
  limits: { name: number, body: number }
}

/** 与服务端 worker/src/index.ts 里的 MAX_NAME / MAX_BODY 保持一致 */
export const LIMITS = { name: 24, body: 1200 } as const

const API = (import.meta.env.VITE_COMMENTS_API ?? '').replace(/\/+$/, '')

export const commentsEnabled = API.length > 0

const CLIENT_KEY = 'site:comment-client'
const AUTH_KEY = 'site:comment-auth'
const NICK_KEY = 'site:comment-nick'

/* ---------- 本地身份 ---------- */

/**
 * 订阅者集合。
 *
 * localStorage 的 storage 事件只在「别的标签页写入」时触发，本页写进去收不到，
 * 所以写入时要自己通知一遍，否则退出登录后界面不会变。
 */
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeStore(callback: () => void): () => void {
  listeners.add(callback)
  if (typeof window === 'undefined') return () => listeners.delete(callback)

  window.addEventListener('storage', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', callback)
  }
}

function store(key: string, value?: string): string {
  if (typeof window === 'undefined') return ''
  try {
    if (value === undefined) return window.localStorage.getItem(key) ?? ''
    window.localStorage.setItem(key, value)
    notify()
    return value
  } catch {
    // 隐私模式 / 禁用存储：留言还能发，只是删不掉、昵称记不住
    return ''
  }
}

export function clientId(): string {
  const existing = store(CLIENT_KEY)
  if (existing) return existing
  const fresh = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ''
  return fresh ? store(CLIENT_KEY, fresh) : ''
}

export function savedNick(): string {
  return store(NICK_KEY)
}

export function rememberNick(nick: string): void {
  store(NICK_KEY, nick)
}

/* ---------- 登录（可选） ---------- */

function decodePayload(token: string): Record<string, unknown> | null {
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const base = token.slice(0, dot).replace(/-/g, '+').replace(/_/g, '/')
  const padded = base.padEnd(Math.ceil(base.length / 4) * 4, '=')
  try {
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
  } catch {
    return null
  }
}

export function authToken(): string {
  return store(AUTH_KEY)
}

/** 未过期才认；过期的令牌留在存储里只会让每次请求都白跑一趟 */
export function currentUser(): { name: string } | null {
  const token = authToken()
  if (!token) return null
  const data = decodePayload(token)
  if (!data || typeof data.exp !== 'number' || data.exp < Date.now()) return null
  return { name: String(data.name ?? '') }
}

/**
 * 给 useSyncExternalStore 用的快照。
 *
 * 必须返回字符串而不是对象：每次 JSON.parse 都会造出新对象，Object.is 判不等，
 * React 会认为数据一直在变，然后无限重渲染。字符串是按值比较的。
 */
export function authNameSnapshot(): string {
  return currentUser()?.name ?? ''
}

/**
 * 登录回来时令牌在 /me/#c=… 里。
 *
 * 取到就立刻从地址栏擦掉：hash 会被复制、被截图、被分享出去，
 * 它不该在浏览历史里留着。
 */
export function captureAuthFromHash(): void {
  if (typeof window === 'undefined') return
  const match = window.location.hash.match(/[#&]c=([^&]+)/)
  if (!match) return

  store(AUTH_KEY, decodeURIComponent(match[1]))
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

export function signOut(): void {
  store(AUTH_KEY, '')
}

export function authStartUrl(): string {
  return `${API}/api/auth/start`
}

/* ---------- 请求 ---------- */

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const id = clientId()
  if (id) headers.set('X-Client-Id', id)

  const token = authToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(API + path, { ...init, headers })
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : `请求失败（${response.status}）`
    throw new Error(message)
  }
  return data as T
}

export async function fetchComments(
  scope: CommentScope,
  thread: string,
  before?: number,
): Promise<CommentPage> {
  const query = new URLSearchParams({ scope, thread })
  if (before) query.set('before', String(before))
  return request<CommentPage>(`/api/comments?${query.toString()}`)
}

export async function postComment(input: {
  scope: CommentScope
  thread: string
  nick: string
  body: string
  /** 蜜罐字段：真实用户永远碰不到它，自动填表的脚本会把每个 input 都写满 */
  website?: string
}): Promise<Comment | null> {
  const data = await request<{ item?: Comment }>('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ ...input, website: input.website ?? '' }),
  })
  return data.item ?? null
}

export async function removeComment(id: string): Promise<void> {
  await request<{ ok: true }>(`/api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

let configPromise: Promise<CommentConfig> | null = null

/** 只取一次：登录入口和限流上限在一次会话里不会变 */
export function loadConfig(): Promise<CommentConfig> {
  configPromise ??= request<CommentConfig>('/api/config').catch(() => ({
    auth: false,
    limits: { name: LIMITS.name, body: LIMITS.body },
  }))
  return configPromise
}

/* ---------- 展示用的格式化 ---------- */

/** 昵称定色相：同一个人每次进来头像都是同一个颜色，不用存 */
export function avatarHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360
  return hash
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`

  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}.${month}.${day}`
}
