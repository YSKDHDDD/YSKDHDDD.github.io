# 留言方案对比评估

> 结论先行：**这个站该走「Cloudflare Worker + D1」，不该走纯 GitHub 评论。**
> giscus 唯一的优势是零运维，代价是把没有 GitHub 账号的读者全部挡在门外；
> 而这条路你已经写完了 90%，缺的只是一次部署和一条仓库变量。

## 一、现状：功能已经写完，线上是关的

先把事实摆清楚，否则容易以为"要从头做留言"。

| 事实 | 位置 / 证据 |
|---|---|
| 线上没有任何留言区 | `https://…/notes/clear-vite-template-residue/` 的 HTML 里 `留言`、`评论` 出现 0 次 |
| 原因是后端没配 | `src/lib/comments.ts`：`commentsEnabled = VITE_COMMENTS_API.length > 0`；Actions 里没有这个变量 |
| 没配就整块不渲染 | `CommentSection`：`if (!commentsEnabled) return null` —— 不会留一个永远转圈的空框 |
| 挂载点已经有四处 | `NoteDetail:149`、`RetroDetail:102`、`LifeDetail:128`（`scope="post"`）、`Me:311`（`scope="guest"` 留言板） |
| 后端已实现 | `worker/src/index.ts`：列表 / 发表 / 删除自己的，Cloudflare Worker + D1 单表 |
| GitHub 登录已实现 | `/oauth/github` → 换 token → 拉 `api.github.com/user` → 写 HMAC 签名的会话；`provider: 'github'` |
| 匿名留言已实现 | localStorage 里的 UUID 作 `X-Client-Id`，服务端只拿它判断"这条是不是你写的" |
| 防滥用已有四道 | 蜜罐字段 `website`、1 分钟最多 2 条、按 IP 的每日额度、重复内容 409 |
| 管理路径 | 已有：`ADMIN_TOKEN` 下架 + 恢复接口，作者删除与管理员下架分别记 `deleted` / `hidden`，都是软删（见第八节） |

所以真正要决策的不是"能不能做"，而是"用谁的账号体系来做"。

## 二、三个候选的机制差异

| | giscus | utterances | 现有 Worker |
|---|---|---|---|
| 存储 | 仓库的 Discussions | 仓库的 Issues | 自己的 D1 表 |
| 身份 | 必须 GitHub 账号 | 必须 GitHub 账号 | 匿名可评，GitHub 登录可选 |
| 写入方式 | GitHub App 代表用户发帖 | 同上 | 自己的 API，Bearer 或 UUID |
| 可见范围 | 公开仓库的 discussion，谁都能去 GitHub 上看 | 公开 issue | 只有你的站和你的库 |
| 数据所有权 | GitHub（你的仓库） | GitHub（你的仓库） | 你自己（可导出 SQL） |
| 维护成本 | 0 | 0 | 一次部署，之后几乎不用管 |
| 自定义能力 | 主题（含自定义 CSS URL）、语言、映射方式 | 主题二选一 | 完全自由（你已经在用） |

giscus 需要的配置项（官方文档核对过，`data-*` 全部是这个拼法）：
`data-repo` `data-repo-id` `data-category` `data-category-id` `data-mapping` `data-strict`
`data-reactions-enabled` `data-emit-metadata` `data-input-position` `data-theme` `data-lang`。
另需三个前置条件：仓库公开、仓库开启 Discussions、装上 giscus App。

## 三、把这套方案放进"这个站"会遇到的五个具体问题

不是理论问题，都可以对着代码指出行号。

**1. 预渲染。** 全站 24 页是构建期静态 HTML（`scripts/prerender.mjs` 会拦"渲染出来但没正文"的页面）。
giscus 的 `<script>` / `<iframe>` 如果在 render 里写，会进静态 HTML —— 预取一次、执行一次、还要再挂 iframe。
必须在 `useEffect` 里注入，且失败时不能留空框。

**2. 路由。** 本站是 SPA 内跳（`/notes/a` → `/notes/b` 不重载页面）。
按 `data-mapping="pathname"` 映射时，必须给评论区换 `key`（`key={pathname}`）强制重挂，
否则 A 文的讨论串会留在 B 文下面 —— 这是接 giscus 最常见的 bug。

**3. 主题。** 站的深浅色走 `document.documentElement.dataset.theme`（首屏前由内联脚本定好，避免闪烁）。
giscus 不认识这个属性，只能 `postMessage({ giscus: { setConfig: { theme } } })` 跟一手；
切色是瞬时切换，评论区会滞后半秒，视觉上能看出来。
**这一条对本站影响最大**：现有的 `CommentSection.css` 是等宽小字、斜体数字、细分割线，
而 giscus 内部是 GitHub 的 Primer 样式 —— 接上去等于在精心排过版的文章底部，贴一个别人的控件。

**4. 390px。** 本站移动端按 390 断点专门调过（文字两行截断、角标不裁切）。
giscus iframe 自适应宽度没问题，但它内部最小可用宽度约 320px，
390 减去两侧 24px 后是 342px，能用，但里面是 GitHub 的密度，和整站的行宽节奏对不上。

**5. 读者身份。** 这是决定性的。
giscus / utterances 都要求访客**有 GitHub 账号并授权 App**才能发言（也可以去 GitHub 页面直接评论）。
中文技术站的读者里，愿意为留一句话走一遍境外 OAuth 的比例很低；
而"评论区看着有、其实没人写"，比没有评论区更伤。

## 四、实测数据（本机直连，非国内读者网络）

| 端点 | 状态 | 首字节/连接 | 总量 |
|---|---|---|---|
| `giscus.app/client.js` | 200 | 0.13s connect | 3.6 KB / 0.32s（冷启动那次 1.56s） |
| `giscus.app/zh-CN` | 200 | 0.11s | 40 KB / 0.36s |
| `github.com/login` | 200 | 0.10s | 51 KB / 0.80s |
| `api.github.com/meta` | 200 | 0.12s | 166 KB / 0.63s |

解读：加载脚本本身不贵，**贵的是 iframe 里那次 GitHub GraphQL 请求**，以及它在弱网下失败时你什么都看不到。
另外 worker 侧的变量是 `workers.dev` 域名，国内可达性同样不稳 —— 无论选哪条路，
**都建议绑一个自有域名**（Cloudflare 支持给 Worker 绑自定义域），这一点两条路相等。

## 五、六维对比（只对本站打分）

| 维度 | giscus | 现有 Worker | 备注 |
|---|---|---|---|
| 读者门槛 | ✗ 高 | ✓ 低（匿名可评） | 决定性差异 |
| 运维 | ✓ 零 | △ 一次部署 | Worker 免费额度：10 万请求/天、D1 5 GB |
| 视觉一致性 | ✗ 外部控件 | ✓ 自己的 CSS | 现有样式已成型 |
| 主题同步 | △ 需 postMessage | ✓ 原生 | 深浅色各一次闪烁 |
| 审核/删除 | ✓ 在 GitHub 上删 | ✓ 已补 `ADMIN_TOKEN` 软删 + 恢复 | 匿名方案必须有 admin 路径 |
| 迁移成本 | △ Discussions 可导 | ✓ SQL 可导 | 两边都不锁死 |

## 六、建议

**目标 A：让读者真的能留言（推荐）** → 部署 `worker/`，GitHub 登录作为可选身份。
匿名是主路径，GitHub 账号是加分项而不是门票。之前缺的管理员删除已经补上（第八节），
代码侧不再欠账，剩下的全是部署动作。

**目标 B：完全不碰服务器，两天内上线** → giscus。接受"读者必须有 GitHub 账号"，
并按第三节 1–4 条处理预渲染、路由 key、主题、移动端。

**不推荐 utterances**：功能是 giscus 的子集（没有 reactions、没有分类、没有懒加载等配置），
数据落在 Issues 里，讨论会混进你的 issue 列表；将来想从 Issues 转 Discussions 还要多做一次迁移。

## 七、两条路的落地清单

### A. 部署现有 Worker

1. Cloudflare 建 D1 库 → 把 `database_id` 填进 `worker/wrangler.toml`
2. `npm run db:init` 建表（`comment` 表 + 三个索引，`parent_id` 已预留给将来的楼中楼）
3. `npm run deploy`（不想装 CLI 就把 `worker/dist/index.js` 粘进控制台编辑器）
4. 想开 GitHub 登录：建 OAuth App，把 ID / Secret / `AUTH_SECRET` 设成 Worker 的 secret
5. 仓库 Settings → Secrets and variables → Actions → Variables：`COMMENTS_API = https://<worker 域名>`
6. 重新跑一次部署（push 一个空提交即可），留言区才会出现在线上
7. 建议同时做：绑自定义域名、在 Worker 上设 `ADMIN_TOKEN` / `IP_SALT` 两个 secret、在 `README` 记一句"数据在哪、怎么导出"

### B. 接入 giscus

1. 浏览器里：仓库开 Discussions、装 giscus App、在 giscus.app 拿到 `repo-id` / `category-id`
2. 新增组件，按第三节处理：`useEffect` 注入、`key={pathname}`、`theme` 跟随 `data-theme`、8 秒超时兜底给文字链接
3. `/local?id=` 与 `/me` 的留言板不挂（前者无稳定路径，后者本来就是"给站长的留言"）
4. 部署后需要验证：预渲染 HTML 里没有 iframe、深色切浅色评论区跟着变、390 无横向溢出

## 八、代码侧补完的四件事（2026-10-30）

这四条原来都是"部署后马上会撞上"的缺口，已经改完并在本地跑通。

| 缺口 | 以前 | 现在 |
|---|---|---|
| 管理删除 | 只能删自己的，垃圾留言得进 D1 敲 SQL | `DELETE /api/comments/:id` 带 `ADMIN_TOKEN` → 下架（`hidden`）；作者删自己 → `deleted`。`GET /api/admin/comments` 看审核列表，`POST /api/admin/comments/:id/restore` 撤销。全部软删，`status` 字段终于用上了 |
| IP 哈希无盐 | `sha256(ip)`，IPv4 只有 43 亿个，泄库可反查 | `sha256("${IP_SALT}|${ip}")`，盐优先 `IP_SALT`、退回 `AUTH_SECRET` |
| 分页漏条 | `created_at < ?`，同毫秒的第二条被跳过 | 复合游标 `<created_at>_<id>`，`(created_at, id)` 做次级比较；前端把 `next` 当不透明字符串原样回传 |
| thread 静默改址 | 非法字符被剔掉，`a_b` 变成 `ab`，两条内容共用一个讨论串 | 不合法就 400；合法字符集 `[A-Za-z0-9_-]{1,64}` |

顺带在本地把这块 UI 真正看了一遍（此前它从没渲染过），改了两处：

- **行宽**：留言区原来占满 1072px 的内容栏，一行能排 140 字，收到 680px（站里标题/正文一直在用的那一档）。
- **输入框**：固定三行时，第 4 行只露半截、正好压在计数器上。改成跟着内容长高，320px 封顶后内部滚动。

本地验证（`worker/dev-node.mjs` + `npm run dev`，30 条数据）：分页 20 + 11 两页无重叠、
两页合计等于 total；越权删除 403、管理员下架/恢复/审核列表均正常；1440 深浅色与 390
均无横向溢出、0 控制台报错。

---

*第一至七节是当初的选型评估，第八节记录之后补的代码改动。实测数据采集于 2026-10-30。*
