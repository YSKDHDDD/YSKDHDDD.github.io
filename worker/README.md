# 留言后端

一个 Cloudflare Worker + 一张 D1 表，覆盖「列留言 / 写留言 / 删自己的留言」。
免费额度对个人站是过剩的：Workers 每天 10 万次请求，D1 5GB 存储、每天 500 万行读。

主站是纯静态的 GitHub Pages，没有服务端，所以留言必须落到这里。

## 第一次部署

需要一个 Cloudflare 账号（免费）和 Node 18+。

```bash
cd worker
npm install

# 1. 登录，会打开浏览器授权
npx wrangler login

# 2. 建库。输出里有一行 database_id，复制它
npx wrangler d1 create site-comments

# 3. 把 database_id 填进 wrangler.toml

# 4. 建表（远端库）
npm run db:init

# 5. 部署。输出里会给出 https://site-comments.<你的子域>.workers.dev
npm run deploy
```

## 接到前端

把上面那个 `workers.dev` 地址写进仓库根目录的 `.env`（结尾不带斜杠）：

```
VITE_COMMENTS_API=https://site-comments.xxx.workers.dev
```

线上构建跑在 GitHub Actions 里，所以要另外在仓库
**Settings → Secrets and variables → Actions → Variables** 新建一个 `COMMENTS_API`，
值同上。不建也能构建成功，只是线上不渲染留言区。

改完重新部署一次即可。前端只在 `VITE_COMMENTS_API` 非空时才挂载留言组件，
所以地址填错的表现是「什么都没有」，不是「一个永远转圈的空框」。

## 本地调试

```bash
npm run db:local   # 在 .wrangler/state 里建一份本地 SQLite
npm run dev        # http://localhost:8787
```

把 `.env` 的 `VITE_COMMENTS_API` 指向 `http://localhost:8787`，主站 `npm run dev`
起来就能连着调。本地库和远端库是分开的，随便清。

## 可选：GitHub 登录

默认关闭。要开就去 GitHub 建一个 OAuth App
（Settings → Developer settings → OAuth Apps），回调地址填
`https://site-comments.xxx.workers.dev/api/auth/callback`，然后：

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put AUTH_SECRET      # 随便一串长随机数，用来签令牌
```

三个都配齐后 `/api/config` 才会返回 `auth: true`，前端这时才把「用 GitHub 登录」
的链接渲染出来。没配就完全不存在这个入口 —— 不放点了没反应的假按钮。

登录后令牌放在 `/me/#c=…` 里带回前端，存储后立刻从地址栏擦掉。
令牌 30 天过期，`AUTH_SECRET` 一换全部失效。

## 管理

留言默认直接可见（`status = 'ok'`），不做前置审核 —— 个人站一天来不了几条，
让人写完看不见反而更糟。要撤下某条：

```bash
# 软删除，记录还在，列表里不再出现
npx wrangler d1 execute site-comments --remote \
  --command "UPDATE comments SET status='hidden' WHERE id='<uuid>'"

# 或者看最新几条
npx wrangler d1 execute site-comments --remote \
  --command "SELECT created_at, thread, author_name, substr(body,1,40) FROM comments ORDER BY created_at DESC LIMIT 20"
```

区块索引是 `(scope, thread, status, created_at DESC)`，文章再多也是走索引的一页。

## 防刷

三道，都在 `createComment` 里：

| 手段 | 规则 |
| --- | --- |
| 蜜罐字段 | 表单里有个 `website` 输入框被挪到视口外，真人看不见，自动填表的脚本会填满 → 整条静默丢弃 |
| 限流 | 同一 IP 一分钟最多 2 条、一天最多 20 条（读 `CF-Connecting-IP`） |
| 去重 | 同一作者两分钟内发同样的内容，当成重复提交直接拒绝 |

没有接 Turnstile：`challenges.cloudflare.com` 在国内经常连不上，配了它而脚本加载不出来，
整个留言区就废了。真要加，在 `createComment` 里补一段 `siteverify` 请求，
前端在 `CommentForm` 里挂一个 widget 就行。
