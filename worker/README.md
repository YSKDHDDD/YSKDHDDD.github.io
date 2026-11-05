# 留言后端

一个 Cloudflare Worker + 一张 D1 表，覆盖「列留言 / 写留言 / 下架留言」。
下架是软删（`status` 换值），作者删自己的与管理员下架的分开记，能撤销。
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
npm run db:create

# 3. 把 database_id 填进 wrangler.toml

# 4. 建表（远端库）
npm run db:init

# 5. 部署。输出里会给出 https://site-comments.<你的子域>.workers.dev
npm run deploy
```

上面五步的顺序不能调换：没 `login` 的 `db:create` 会直接报未认证；没建库或
`wrangler.toml` 里还是那串全零占位符时，`db:init` 会报找不到这个 database；
而没先建表的 `deploy` 虽然能成功，但管理接口一调就 500。

**跑不动时看这两个报错：**

| 报错 | 原因 | 解法 |
| --- | --- | --- |
| `'wrangler' 不是内部或外部命令` | `worker/` 有自己的 `node_modules`，根目录装过不代表这里有；`npm run` 只找本目录的 `.bin` | 在这个目录里 `npm install` |
| `You are not authenticated` | 本机从没登录过，或登录凭证被清掉 | `npx wrangler login` |

`npx wrangler whoami` 可以随时自查当前登录的是哪个账号；换账号后再跑一次 `login`。

## 不想装 CLI：整套在控制台做

`wrangler` 的 postinstall 在某些网络环境下会卡很久（实测一次卡了 14 分钟没装完）。
不想折腾命令行的话，浏览器里也能走完全程。

**先编译一次。** 控制台的编辑器只跑 JavaScript，而 `src/index.ts` 里全是类型注解
（`interface Env`、`env: Env` 之类），原样贴进去会直接报语法错误。在仓库根目录执行：

```bash
node_modules/.bin/tsc -p worker/tsconfig.json --noEmit false \
  --rootDir worker/src --outDir worker/dist
```

得到 `worker/dist/index.js`（约 15KB，单文件、零 import），第 4 步贴的是它。
之后改过 `src/index.ts` 要重新跑一次。

1. dash.cloudflare.com → **存储和数据库 → D1 SQL 数据库 → 创建**，名字填 `site-comments`
2. 建好后进 **控制台**，把 `schema.sql` 全文贴进去执行（三张索引会一起建好）
3. 左侧 **Workers 和 Pages → 创建 → Worker**，命名 `site-comments`
   —— 这个名字决定最终域名是 `site-comments.<你的子域>.workers.dev`
4. 进 **编辑代码**，把编辑器里默认内容整个删掉，粘贴 `worker/dist/index.js` 的全部内容，Deploy
5. **设置 → 绑定 → 添加 → D1 数据库**，变量名必须是 `DB`（大写，代码里写死的），选中第 1 步建的库
6. **设置 → 变量和机密** 里加两个明文变量：
   - `ALLOWED_ORIGINS` = `https://你的用户名.github.io`
   - `PUBLIC_ORIGIN` = `https://你的用户名.github.io`
7. 再 Deploy 一次，绑定和变量才会生效

> **可选的两个机密**：`ADMIN_TOKEN`（管理接口的口令，见「管理」一节）与 `IP_SALT`
> （IP 哈希的盐，不配就退回 `AUTH_SECRET`，两个都没有才是不加盐 —— 不加盐的
> `sha256(ip)` 等于没哈希，IPv4 只有 43 亿个，泄库即可反查）。

**自检**：浏览器打开 `https://site-comments.<子域>.workers.dev/api/config`，
应当返回类似 `{"auth":false,"limits":{"name":24,"body":1200}}`。
返回 500 基本就是第 5 步的 `DB` 没绑对。

完成后拿到的 `https://site-comments.<子域>.workers.dev` 就是前端要填的地址。

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

要是 `npm install` 卡在 wrangler 的 postinstall 一直不动，可以不装它，直接用 Node 22 跑：

```bash
# 想连管理接口一起试，就把两个口令也带上
ADMIN_TOKEN=dev-admin-token AUTH_SECRET=dev-secret node dev-node.mjs
```

它每次启动都会重建本地库，适合反复测。主站那边配一句
`VITE_COMMENTS_API=http://localhost:8787 npm run dev` 就能连着看。这个只是本地联调的替代品，部署仍要走
wrangler 或上面的控制台流程。

## 可选：GitHub 登录

默认关闭。三步，全部在浏览器里完成。

**1. 建 OAuth App** —— GitHub → Settings → Developer settings → OAuth Apps → New OAuth App：

| 字段 | 填什么 |
| --- | --- |
| Application name | 随便，比如「站点留言」 |
| Homepage URL | `https://你的用户名.github.io` |
| Authorization callback URL | `https://site-comments.<子域>.workers.dev/api/auth/callback` |

回调地址必须**逐字符一致**，多一个斜杠都会授权失败。本地调试要另外建一个 OAuth App，
回调填 `http://localhost:8787/api/auth/callback`——两者不能共用同一个。

**2. 拿两个值** —— 建好后页面上直接给 Client ID；点 Generate a new client secret，
那一串只显示一次，先复制走。

**3. 写进 Worker** —— 该 Worker 的 设置 → 变量和机密，加三条，类型全部选**机密（Secret）**：

| 名称 | 值 |
| --- | --- |
| `GITHUB_CLIENT_ID` | 上一步的 Client ID |
| `GITHUB_CLIENT_SECRET` | 上一步的 Client secret |
| `AUTH_SECRET` | 一串长随机数（`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`），用来签令牌；换掉它等于让所有已登录的人掉线 |

Deploy 之后再访问 `/api/config`，`auth` 变成 `true` 就通了。
**前端不需要重新部署**——登录入口是运行时读 `/api/config` 决定的，不参与构建。

三个都配齐后 `/api/config` 才会返回 `auth: true`，前端这时才把「用 GitHub 登录」
的链接渲染出来。没配就完全不存在这个入口 —— 不放点了没反应的假按钮。

匿名留言始终可用，登录只是多一层「这个昵称归谁」的保证，不是门槛。

登录后令牌放在 `/me/#c=…` 里带回前端，存储后立刻从地址栏擦掉。
令牌 30 天过期，`AUTH_SECRET` 一换全部失效。

## 管理

留言默认直接可见（`status = 'ok'`），不做前置审核 —— 个人站一天来不了几条，
让人写完看不见反而更糟。

先给 Worker 加一个机密变量 `ADMIN_TOKEN`（一串长随机数）。不配就没有管理接口，
作者仍然能删自己的。之后三条命令就够：

```bash
API=https://site-comments.<子域>.workers.dev
TOKEN=<ADMIN_TOKEN>

# 1. 看被我撤掉的（status=any 连作者自己删的一起看）
curl -H "Authorization: Bearer $TOKEN" "$API/api/admin/comments?status=any"

# 2. 下架某条（作者看不到、列表里也没有，行还在）
curl -X DELETE -H "Authorization: Bearer $TOKEN" "$API/api/comments/<uuid>"

# 3. 撤错了，恢复
curl -X POST -H "Authorization: Bearer $TOKEN" "$API/api/admin/comments/<uuid>/restore"
```

`status` 的三个值：`ok` 在列表里，`deleted` 是作者自己删的，`hidden` 是我下架的。
一律软删 —— 硬删之后既没有证据，也没法撤销，而一行本来只有几十字节。

真要直接动库（导出、批量清理）也可以：

```bash
npx wrangler d1 execute site-comments --remote \
  --command "SELECT created_at, thread, author_name, substr(body,1,40) FROM comments WHERE status <> 'ok' ORDER BY created_at DESC LIMIT 20"
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

## 安全管理

### 口令与密钥

| 名称 | 怎么配 | 作用 | 泄漏/轮换的后果 |
| --- | --- | --- | --- |
| `ADMIN_TOKEN` | `wrangler secret put` | 管理接口（列下架 / 恢复）的口令 | 换新的即可，旧值下一次请求就失效 |
| `AUTH_SECRET` | `wrangler secret put` | 签发登录令牌 + 给 IP 哈希加盐 | 换掉之后所有人被登出（签名不再匹配），这是预期行为 |
| `IP_SALT` | `wrangler secret put` | 只给 IP 哈希加盐 | 换掉之后历史 `ip_hash` 与新记录对不上，限流从零开始计 |
| `GITHUB_CLIENT_SECRET` | `wrangler secret put` | 换 GitHub access token | 去 GitHub 后台重置，同时更新这里 |

用 `wrangler secret` 而不是 `[vars]`：`vars` 会写进 `wrangler.toml`，跟着仓库走，等于公开。

### 管理口令的爆破闸

十分钟内错五次，这个 IP 的 `/api/admin/*` 全部 429 —— 此时即使口令对了也不放行，
不给「试对了」任何信号。成功一次就把记录清空。

计数落在 D1 的 `admin_failures` 表，不放在内存里：Worker 的 isolate 随时会被回收，
进程内计数等于没有。表里只保留最近十分钟的行，每次写失败顺手清一次过窗的。

没带 `Authorization` 的请求只回 401、不计数 —— 否则任何陌生人点一下这个地址，
就能把站主自己的 IP 关十分钟。

自己把自己锁了（比如脚本里口令写错跑了五次）：

```bash
npx wrangler d1 execute site-comments --remote --command "DELETE FROM admin_failures"
```

等十分钟也行，过窗的行会被下一次失败顺手清掉。

### 请求体上限

`MAX_JSON_BYTES = 16KB`。正文上限 1200 字，中文按三字节算 3.6KB，这个额度很宽。
先看 `Content-Length` 挡掉明显超标的，读完再量一次实际长度 —— 头部是客户端说的，
可以撒谎，也可以干脆没有（chunked）。

### 响应头

每个响应（包括 204 预检和登录回调的纯文本错误页）都带：

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000
```

### 备份与恢复

D1 自带 Time Travel，30 天内可以回到任意时间点（这是首选，不用自己排计划）：

```bash
npx wrangler d1 time-travel info site-comments
npx wrangler d1 time-travel restore site-comments --timestamp=2026-11-05T10:00:00Z
```

逻辑导出用于离线留档或换账号迁移：

```bash
npx wrangler d1 export site-comments --remote --output backup-$(date +%F).sql
```

建议在「改表结构」和「批量清理」前后各导一次 —— 个人站这个量级，不需要更密的排期。
导出的 sql 里有 `ip_hash`，虽然加了盐，仍然按敏感文件对待，别往仓库里提交。

### 没做的，以及为什么

- **Turnstile**：`challenges.cloudflare.com` 在国内经常连不上，加载不出来整个留言区就废了。
- **WAF / 自定义限流规则**：免费版能配的规则有限，留言量也撑不起额外一层。
  真要更强，在 `createComment` 里加 `siteverify` 请求即可。
- **点击劫持防护**：需要 `X-Frame-Options` 或 `frame-ancestors` 响应头，
  主站是 GitHub Pages，不支持自定义头，只做了 meta 能表达的那部分（见根目录 README 的「安全」一节）。
