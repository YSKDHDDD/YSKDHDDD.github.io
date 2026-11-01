/**
 * 站点留言 API —— 一个 Worker、一张 D1 表。
 *
 * 三件事：按分区列留言、写留言、把某条留言下架。
 * 身份默认是匿名的：前端给每个浏览器发一个 UUID，写在 X-Client-Id 头里，
 * 服务端只把它当「谁写的」用，不认人。登录是可选的 —— 三个 secret 都配齐，
 * /api/config 才会返回 auth:true，前端这时才把「用 GitHub 登录」的按钮渲染出来。
 * 没配就是纯匿名，不存在点了没反应的假按钮。
 *
 * 删除不是 DELETE，是给 status 换个值：作者删的标 'deleted'，管理员下架的标
 * 'hidden'，两者都从列表里消失，但行还在。理由很实际 —— 匿名开放，第一条垃圾
 * 或者骂人的话总会出现，进 D1 手敲 SQL 是最慢的一条路；而且误删要能撤销。
 *
 * 所有写入都过三道闸：蜜罐字段（机器人会填）、限流（同 IP 一分钟两条 / 一天二十条）、
 * 两分钟内的相同内容去重。CORS 只放白名单，但它不是安全边界 —— curl 根本不看它，
 * 真正拦住刷屏的是限流。
 *
 * 没有接 Turnstile：challenges.cloudflare.com 在国内经常连不上，配了它而脚本加载
 * 不出来，整个留言区就废了。个人站这个量级，限流 + 蜜罐足够；真要更强防护，
 * 在这里加一段 siteverify 即可，前端在 CommentForm 里补一个 widget。
 */

/* ---------- 运行时提供的东西，这里只声明用到的那部分 ---------- */

interface D1Stmt {
  bind(...values: unknown[]): D1Stmt
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ success: boolean; meta: { changes: number } }>
}

interface Env {
  DB: { prepare(sql: string): D1Stmt }
  ALLOWED_ORIGINS?: string
  PUBLIC_ORIGIN?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  AUTH_SECRET?: string
  /** 下架 / 恢复用的口令。不配就没有管理接口，作者仍然能删自己的。 */
  ADMIN_TOKEN?: string
  /** IP 哈希的盐。不配就退回 AUTH_SECRET；两个都没有才是不加盐。 */
  IP_SALT?: string
}

interface AuthUser {
  id: string
  name: string
  url: string | null
  provider: 'github'
}

interface CommentRow {
  id: string
  author_id: string
  author_name: string
  author_url: string | null
  provider: string
  body: string
  created_at: number
}

/* ---------- 常量：前端也按这些值做校验，改一处要改两处 ---------- */

const MAX_NAME = 24
const MAX_BODY = 1200
const PAGE_SIZE = 20
const ADMIN_PAGE_SIZE = 50
const RATE_WINDOW = 60_000
const RATE_MAX = 2
const DAILY_WINDOW = 86_400_000
const DAILY_MAX = 20
const TOKEN_TTL = 30 * 86_400_000

/**
 * status 的三个取值。'ok' 是唯一会被公开列表查到的值，
 * 另外两个都是「下架」：作者自己删的记 'deleted'，管理员下架的记 'hidden' ——
 * 分开记是为了以后能分辨"他自己后悔了"和"我给他撤了"。
 */
const STATUS_OK = 'ok'
const STATUS_HIDDEN = 'hidden'
const STATUS_DELETED = 'deleted'

/**
 * thread 只允许 ASCII 字母数字、下划线和连字符。
 *
 * 以前的做法是把非法字符剔掉：`a_b` 会变成 `ab`，和真的叫 `ab` 的那篇文章共用
 * 一个讨论串，两边的留言混在一起还很难发现。宁可 400，也不要静默改地址。
 */
const THREAD_RE = /^[A-Za-z0-9_-]{1,64}$/

const utf8 = new TextEncoder()

/* ---------- 小工具 ---------- */

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...cors,
    },
  })
}

/**
 * 只回显白名单里的 Origin。
 *
 * 不在白名单就干脆不给 ACAO —— 浏览器会拦下响应，站点也拿不到数据。
 * 这挡不住 curl，但 curl 本来也不需要被挡，限流才是那道闸。
 */
function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Client-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }

  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', utf8.encode(text)))
}

/**
 * 定长比较。
 *
 * 直接 `a === b` 会在第一个不同的字节返回，理论上能按响应时间把口令一位一位试出来。
 * 这里把整个字符串异或完再判断，长度也先混进去，不给长度差留信号。
 */
function safeEqual(a: string, b: string): boolean {
  const left = utf8.encode(a)
  const right = utf8.encode(b)
  let diff = left.length ^ right.length
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return diff === 0
}

/**
 * IP 只以加盐哈希的形式落库。
 *
 * 不加盐的 sha256(ip) 等于没哈希：IPv4 只有 43 亿个，一张彩虹表几分钟跑完，
 * 库一旦泄露，每条留言都能对上具体的人。盐用 IP_SALT，没配就退回 AUTH_SECRET
 * （它本来就要配）；两个都没有才是不加盐，那种情况只在本地联调时出现。
 */
async function ipDigest(ip: string, env: Env): Promise<string> {
  const salt = env.IP_SALT ?? env.AUTH_SECRET ?? ''
  return sha256(`${salt}|${ip}`)
}

function isAdmin(request: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false
  const header = request.headers.get('Authorization') ?? ''
  if (!header.startsWith('Bearer ')) return false
  return safeEqual(header.slice(7), env.ADMIN_TOKEN)
}

/**
 * 分页游标：`<created_at>_<id>`。
 *
 * 只用时间戳当下界会漏条 —— 同一个毫秒写进来的两条，第二条的 created_at 相等，
 * `created_at < ?` 直接跳过它。带上 id 做次级比较，页与页之间才是无缝的。
 */
function parseCursor(raw: string | null): { at: number; id: string } | null {
  if (!raw) return null
  const match = /^(\d{1,15})_([A-Za-z0-9-]{1,64})$/.exec(raw)
  if (!match) return null
  return { at: Number(match[1]), id: match[2] }
}

function makeCursor(row: { id: string; created_at: number }): string {
  return `${row.created_at}_${row.id}`
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? utf8.encode(input) : input
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64url(text: string): string {
  const base = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base.padEnd(Math.ceil(base.length / 4) * 4, '=')
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)))
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8.encode(data))))
}

/**
 * 去掉控制字符、统一换行、按字数截断。
 *
 * 不剥 HTML：渲染在 React 里，默认转义；反过来把 `<` 洗掉会让「a < b」这种
 * 正常的留言变味。真要防注入，该防的是渲染端，不是存储端。
 */
function clean(input: unknown, max: number): string {
  return String(input ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, max)
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? '0.0.0.0'
}

/* ---------- 身份 ---------- */

async function readAuth(request: Request, env: Env): Promise<AuthUser | null> {
  const header = request.headers.get('Authorization') ?? ''
  if (!header.startsWith('Bearer ') || !env.AUTH_SECRET) return null

  const token = header.slice(7)
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null

  const payload = token.slice(0, dot)
  if ((await hmac(payload, env.AUTH_SECRET)) !== token.slice(dot + 1)) return null

  try {
    const data = JSON.parse(unb64url(payload)) as AuthUser & { exp: number }
    if (!data.exp || data.exp < Date.now()) return null
    return { id: data.id, name: data.name, url: data.url ?? null, provider: 'github' }
  } catch {
    return null
  }
}

/**
 * 「谁在说话」。
 *
 * 登录了就用账号 ID，否则用浏览器 UUID；两样都没有（禁了 localStorage 的
 * 极端浏览器）才退回 IP —— 那样至少还能留言，只是删不掉。
 */
async function viewerId(request: Request, env: Env, ip: string): Promise<string> {
  const auth = await readAuth(request, env)
  if (auth) return auth.id

  const raw = (request.headers.get('X-Client-Id') ?? '').trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return `anon:${raw}`
  }
  return `anon:ip:${await ipDigest(ip, env)}`
}

/* ---------- 各个路由 ---------- */

async function listComments(
  request: Request,
  url: URL,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const scope = url.searchParams.get('scope') === 'guest' ? 'guest' : 'post'
  const thread = (url.searchParams.get('thread') ?? '').trim()
  if (!THREAD_RE.test(thread)) return json({ error: 'thread 不合法' }, 400, cors)

  const cursor = parseCursor(url.searchParams.get('before'))
  const viewer = await viewerId(request, env, clientIp(request))

  // 多取一条，用来判断还有没有下一页，不用再算一次 count。
  // 游标那一段是 (created_at, id) 的复合比较，见 parseCursor 上面的注释。
  const rows = cursor
    ? await env.DB.prepare(
        `SELECT id, author_id, author_name, author_url, provider, body, created_at
           FROM comments
          WHERE scope = ? AND thread = ? AND status = 'ok'
            AND (created_at < ? OR (created_at = ? AND id < ?))
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
      )
        .bind(scope, thread, cursor.at, cursor.at, cursor.id, PAGE_SIZE + 1)
        .all<CommentRow>()
    : await env.DB.prepare(
        `SELECT id, author_id, author_name, author_url, provider, body, created_at
           FROM comments
          WHERE scope = ? AND thread = ? AND status = 'ok'
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
      )
        .bind(scope, thread, PAGE_SIZE + 1)
        .all<CommentRow>()

  const items = rows.results.slice(0, PAGE_SIZE)
  const total = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM comments WHERE scope = ? AND thread = ? AND status = 'ok'`,
  )
    .bind(scope, thread)
    .first<{ n: number }>()

  return json(
    {
      items: items.map((row) => ({
        id: row.id,
        author: {
          name: row.author_name,
          url: row.author_url,
          provider: row.provider === 'github' ? 'github' : 'anon',
        },
        body: row.body,
        createdAt: row.created_at,
        mine: row.author_id === viewer,
      })),
      total: total?.n ?? items.length,
      next: rows.results.length > PAGE_SIZE && items.length ? makeCursor(items[items.length - 1]) : null,
    },
    200,
    cors,
  )
}

async function createComment(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const ip = clientIp(request)
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!payload) return json({ error: '请求格式不对' }, 400, cors)

  const scope = payload.scope === 'guest' ? 'guest' : 'post'
  const thread = String(payload.thread ?? '').trim()
  if (!THREAD_RE.test(thread)) return json({ error: 'thread 不合法' }, 400, cors)

  // 蜜罐：这个字段在页面上被 CSS 藏起来，真人看不见，机器人会老老实实填
  if (String(payload.website ?? '').trim()) return json({ ok: true }, 200, cors)

  const auth = await readAuth(request, env)
  const name = clean(auth ? auth.name : payload.nick, MAX_NAME)
  const body = clean(payload.body, MAX_BODY)

  if (!name) return json({ error: '还没写昵称' }, 400, cors)
  if (!body) return json({ error: '还没写内容' }, 400, cors)

  const viewer = auth?.id ?? (await viewerId(request, env, ip))
  const digest = await ipDigest(ip, env)

  // 限流：一分钟两条、一天二十条。个人站的留言板，这个量足够正常对话，
  // 又不至于让脚本三分钟刷满一屏。下架的行也算额度 —— 否则「发一条、删一条」
  // 就能无限刷，而删只是改 status，行还在。
  const since = Date.now() - RATE_WINDOW
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > ?`,
  )
    .bind(digest, since)
    .first<{ n: number }>()
  if ((recent?.n ?? 0) >= RATE_MAX) {
    return json({ error: '慢一点，一分钟内最多两条' }, 429, cors)
  }

  const dayAgo = Date.now() - DAILY_WINDOW
  const today = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > ?`,
  )
    .bind(digest, dayAgo)
    .first<{ n: number }>()
  if ((today?.n ?? 0) >= DAILY_MAX) {
    return json({ error: '今天的额度用完了，明天再来' }, 429, cors)
  }

  // 同一个人连着发同一段，多半是双击或者网络重试，直接当重复处理。
  // 只看还在列表里的那几条：删掉之后想重发一遍，是正当的。
  const duplicate = await env.DB.prepare(
    `SELECT id FROM comments WHERE author_id = ? AND body = ? AND status = 'ok' AND created_at > ? LIMIT 1`,
  )
    .bind(viewer, body, Date.now() - 120_000)
    .first<{ id: string }>()
  if (duplicate) return json({ error: '这条刚发过了' }, 409, cors)

  const now = Date.now()
  const id = crypto.randomUUID()

  await env.DB.prepare(
    `INSERT INTO comments
       (id, scope, thread, author_id, author_name, author_url, provider, body, status, ip_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      scope,
      thread,
      viewer,
      name,
      auth?.url ?? null,
      auth ? 'github' : 'anon',
      body,
      STATUS_OK,
      digest,
      now,
      now,
    )
    .run()

  return json(
    {
      item: {
        id,
        author: { name, url: auth?.url ?? null, provider: auth ? 'github' : 'anon' },
        body,
        createdAt: now,
        mine: true,
      },
    },
    201,
    cors,
  )
}

/**
 * 下架一条留言。
 *
 * 作者删自己的：status 换成 'deleted'，管理员下架的：换成 'hidden'。
 * 都不是 DELETE —— 硬删之后既没有证据，也没法撤销，而这一行本来也就几十字节。
 *
 * 管理员走的是同一个入口：带 ADMIN_TOKEN 的请求可以下架任何人的留言，
 * 前提是它此刻还是 'ok'；已经下架过的再删一次会返回 200（幂等），不报错。
 */
async function deleteComment(
  request: Request,
  id: string,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const admin = isAdmin(request, env)
  const now = Date.now()

  if (admin) {
    await env.DB.prepare(
      `UPDATE comments SET status = ?, updated_at = ? WHERE id = ? AND status = 'ok'`,
    )
      .bind(STATUS_HIDDEN, now, id)
      .run()

    // 幂等：已经下架过的再点一次也返回 200，管理脚本不必先查一遍状态
    return json({ ok: true }, 200, cors)
  }

  const viewer = await viewerId(request, env, clientIp(request))
  const result = await env.DB.prepare(
    `UPDATE comments SET status = ?, updated_at = ? WHERE id = ? AND author_id = ? AND status = 'ok'`,
  )
    .bind(STATUS_DELETED, now, id, viewer)
    .run()

  if (!result.meta.changes) return json({ error: '这不是你的留言' }, 403, cors)
  return json({ ok: true, status: STATUS_DELETED }, 200, cors)
}

/* ---------- 管理：审核列表与恢复 ---------- */

interface AdminRow {
  id: string
  scope: string
  thread: string
  author_name: string
  provider: string
  body: string
  status: string
  created_at: number
}

/** 只列下架的：`status=hidden`（默认）看被我撤掉的，`any` 连他自己删的一起看 */
async function adminList(
  request: Request,
  url: URL,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: '口令不对' }, 401, cors)

  const filter = url.searchParams.get('status') === 'any' ? 'any' : 'hidden'
  const cursor = parseCursor(url.searchParams.get('before'))
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '') || ADMIN_PAGE_SIZE, 1), 100)
  const where = filter === 'any' ? 'status IN (?, ?)' : 'status = ?'
  const args: unknown[] = filter === 'any' ? [STATUS_HIDDEN, STATUS_DELETED] : [STATUS_HIDDEN]

  const rows = cursor
    ? await env.DB.prepare(
        `SELECT id, scope, thread, author_name, provider, body, status, created_at
           FROM comments
          WHERE ${where} AND (created_at < ? OR (created_at = ? AND id < ?))
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
      )
        .bind(...args, cursor.at, cursor.at, cursor.id, limit + 1)
        .all<AdminRow>()
    : await env.DB.prepare(
        `SELECT id, scope, thread, author_name, provider, body, status, created_at
           FROM comments
          WHERE ${where}
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
      )
        .bind(...args, limit + 1)
        .all<AdminRow>()

  const items = rows.results.slice(0, limit)
  return json(
    {
      items: items.map((row) => ({
        id: row.id,
        scope: row.scope,
        thread: row.thread,
        author: row.author_name,
        provider: row.provider,
        body: row.body,
        status: row.status,
        createdAt: row.created_at,
      })),
      next: rows.results.length > limit && items.length ? makeCursor(items[items.length - 1]) : null,
    },
    200,
    cors,
  )
}

/** 撤销一次下架。误删之后最需要的就是这一步，不然只能进 D1 手敲 UPDATE */
async function adminRestore(
  request: Request,
  id: string,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: '口令不对' }, 401, cors)

  const result = await env.DB.prepare(
    `UPDATE comments SET status = ?, updated_at = ? WHERE id = ? AND status <> 'ok'`,
  )
    .bind(STATUS_OK, Date.now(), id)
    .run()

  if (!result.meta.changes) return json({ error: '这条不在下架列表里' }, 404, cors)
  return json({ ok: true, status: STATUS_OK }, 200, cors)
}

/* ---------- 可选的 GitHub 登录 ---------- */

function authReady(env: Env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.AUTH_SECRET)
}

async function authStart(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (!authReady(env)) return json({ error: '没有配置 GitHub 登录' }, 501, cors)

  // 自校验 state：时间戳 + HMAC，十分钟内有效。不存 session 表也能防 CSRF。
  const stamp = Date.now().toString()
  const state = `${stamp}.${await hmac(stamp, env.AUTH_SECRET ?? '')}`

  const target = new URL('https://github.com/login/oauth/authorize')
  target.searchParams.set('client_id', env.GITHUB_CLIENT_ID ?? '')
  target.searchParams.set('redirect_uri', new URL('/api/auth/callback', request.url).toString())
  target.searchParams.set('scope', 'read:user')
  target.searchParams.set('state', state)

  return Response.redirect(target.toString(), 302)
}

async function authCallback(url: URL, env: Env): Promise<Response> {
  if (!authReady(env)) return new Response('没有配置 GitHub 登录', { status: 501 })

  const code = url.searchParams.get('code')
  const [stamp, signature] = (url.searchParams.get('state') ?? '').split('.')
  if (!code || !stamp || !signature) return new Response('参数不全', { status: 400 })
  if ((await hmac(stamp, env.AUTH_SECRET ?? '')) !== signature) return new Response('state 不匹配', { status: 400 })
  if (Date.now() - Number(stamp) > 600_000) return new Response('登录过期了，请重试', { status: 400 })

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'site-comments' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })
  const tokenData = (await tokenRes.json().catch(() => ({}))) as { access_token?: string }
  if (!tokenData.access_token) return new Response('换取令牌失败', { status: 502 })

  const meRes = await fetch('https://api.github.com/user', {
    headers: {
      authorization: `Bearer ${tokenData.access_token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'site-comments',
    },
  })
  const me = (await meRes.json().catch(() => ({}))) as { login?: string; html_url?: string }
  if (!me.login) return new Response('读取 GitHub 账号失败', { status: 502 })

  const payload = b64url(
    JSON.stringify({
      id: `github:${me.login}`,
      name: me.login,
      url: me.html_url ?? null,
      provider: 'github',
      exp: Date.now() + TOKEN_TTL,
    }),
  )
  const token = `${payload}.${await hmac(payload, env.AUTH_SECRET ?? '')}`

  // 令牌放在 hash 里：不会进服务器日志，也不会被 Referer 带去别处
  const back = `${(env.PUBLIC_ORIGIN ?? '').replace(/\/+$/, '')}/me/#c=${token}`
  return Response.redirect(back, 302)
}

/* ---------- 入口 ---------- */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const path = url.pathname.replace(/\/+$/, '') || '/'

    try {
      if (path === '/' || path === '/health') {
        return json({ ok: true, service: 'site-comments' }, 200, cors)
      }

      if (path === '/api/config' && request.method === 'GET') {
        return json(
          {
            auth: authReady(env),
            limits: { name: MAX_NAME, body: MAX_BODY },
          },
          200,
          cors,
        )
      }

      if (path === '/api/comments' && request.method === 'GET') {
        return await listComments(request, url, env, cors)
      }

      if (path === '/api/comments' && request.method === 'POST') {
        return await createComment(request, env, cors)
      }

      if (path.startsWith('/api/comments/') && request.method === 'DELETE') {
        const id = path.slice('/api/comments/'.length).replace(/[^a-zA-Z0-9-]/g, '')
        if (!id) return json({ error: '缺少 id' }, 400, cors)
        return await deleteComment(request, id, env, cors)
      }

      if (path === '/api/admin/comments' && request.method === 'GET') {
        return await adminList(request, url, env, cors)
      }

      if (path.startsWith('/api/admin/comments/') && path.endsWith('/restore') && request.method === 'POST') {
        const id = path.slice('/api/admin/comments/'.length, -'/restore'.length).replace(/[^a-zA-Z0-9-]/g, '')
        if (!id) return json({ error: '缺少 id' }, 400, cors)
        return await adminRestore(request, id, env, cors)
      }

      if (path === '/api/auth/start' && request.method === 'GET') {
        return await authStart(request, env, cors)
      }

      if (path === '/api/auth/callback' && request.method === 'GET') {
        return await authCallback(url, env)
      }

      if (path.startsWith('/api/')) return json({ error: '没有这个接口' }, 404, cors)

      return json({ ok: true, service: 'site-comments' }, 200, cors)
    } catch (error) {
      console.error('unhandled', error)
      return json({ error: '服务器出错了，稍后再试' }, 500, cors)
    }
  },
}
