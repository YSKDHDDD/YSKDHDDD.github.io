/**
 * 不装 wrangler 也能在本地跑起这个 Worker。
 *
 * 用法：node dev-node.mjs [port]
 *
 * 为什么需要它：wrangler 的 postinstall 在某些网络环境下会卡很久（实测 14 分钟没装完，
 * node_modules 涨到 176M 但 .bin 一直是空的）。这个文件用 Node 22 自带的类型剥离
 * 直接加载 src/index.ts，再用 node:sqlite 顶替 D1 —— SQL 是真的在跑，
 * 只是少了 workerd 那层壳。仅用于本地联调，部署仍然走 wrangler 或控制台。
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.argv[2] ?? 8787)
const DB_FILE = path.join(here, '.wrangler', 'd1-local.db')

// 每次启动都从干净的库开始，免得上一轮的限流记录影响这一轮
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
if (fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE)

const database = new DatabaseSync(DB_FILE)
database.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'))

/** D1 的三个方法：first / all / run。语义按 Cloudflare 文档对齐 */
const DB = {
  prepare(sql) {
    const statement = database.prepare(sql)
    let values = []
    return {
      bind(...next) {
        values = next
        return this
      },
      async first() {
        return statement.get(...values) ?? null
      },
      async all() {
        return { results: statement.all(...values) }
      },
      async run() {
        const info = statement.run(...values)
        return { success: true, meta: { changes: Number(info.changes ?? 0) } }
      },
    }
  },
}

const env = {
  DB,
  ALLOWED_ORIGINS:
    process.env.ALLOWED_ORIGINS ??
    'https://yskdhddd.github.io,http://localhost:5173,http://localhost:4179',
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? 'https://yskdhddd.github.io',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  AUTH_SECRET: process.env.AUTH_SECRET,
}

const worker = (await import('./src/index.ts')).default

const server = http.createServer(async (req, res) => {
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const payload = chunks.length ? Buffer.concat(chunks) : undefined

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) for (const item of value) headers.append(key, item)
      else if (value !== undefined) headers.set(key, value)
    }

    const request = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : payload,
    })

    const response = await worker.fetch(request, env)
    const out = {}
    for (const [key, value] of response.headers) out[key] = value
    res.writeHead(response.status, out)
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error('dev-node error', error)
    res.writeHead(500, { 'content-type': 'text/plain' })
    res.end('dev-node error')
  }
})

server.listen(PORT, () => {
  console.log(`worker 跑在 http://localhost:${PORT}  (db: ${DB_FILE})`)
  console.log('前端 .env 里写 VITE_COMMENTS_API=http://localhost:' + PORT)
})
