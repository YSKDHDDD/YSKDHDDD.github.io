# 学习外脑

技术笔记与项目复盘的聚合站。定位是**双层的**：内容层沉淀工程判断，呈现层用界面细节证明审美能力。

React 19 + TypeScript + Vite 8 + Tailwind v4，构建期把每个路由预渲染成真 HTML；留言走一个独立的 Cloudflare Worker。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [`docs/DESIGN_PLAN.md`](./docs/DESIGN_PLAN.md) | 信息架构、设计系统、效果预算、分期与验收标准 |
| [`docs/COMMENTS_AUDIT.md`](./docs/COMMENTS_AUDIT.md) | 留言方案选型：为什么是 Worker + D1 而不是 giscus |
| [`docs/PC_AUDIT.md`](./docs/PC_AUDIT.md) / [`docs/MOBILE_AUDIT.md`](./docs/MOBILE_AUDIT.md) | 全站走查：7 档桌面视口 / 2 档移动视口 |
| [`worker/README.md`](./worker/README.md) | 留言后端部署、GitHub 登录、防刷与管理接口 |

## 快速开始

需要 Node 22+（CI 用的就是 22）。

```bash
npm install
cp .env.example .env    # 可选：不填也能跑，只是 canonical/sitemap 里是 localhost
npm run dev
```

| 命令 | 做什么 |
| --- | --- |
| `npm run dev` | 开发服务器（内容文件增删改会自动整页刷新） |
| `npm run build` | 类型检查 → 客户端构建 → SSR 构建 → 预渲染 + sitemap/RSS |
| `npm run typecheck` | 仅 `tsc -b` |
| `npm run lint` | ESLint |
| `npm run smoke` | SSR 渲染冒烟：10 个页面 + 2 篇 MDX |
| `npm run preview` | 静态预览 `dist`（需先 `npm run build`） |

`npm run build` 实际是四步：

```
tsc -b                  →  类型检查，不通过就不构建
vite build              →  客户端产物（带 hash 的资源）
vite build --ssr ...    →  预渲染用的服务端入口
node scripts/prerender  →  逐路由渲染成 HTML，并生成 sitemap / rss / robots
```

产物里每个路由都有自己的 `index.html`，**正文直接写在 HTML 里**，不依赖 JS 执行。

环境变量三只，都在 `.env.example` 里注明了用途：

| 变量 | 用途 | 线上来源 |
| --- | --- | --- |
| `VITE_SITE_URL` | canonical / `og:url` / sitemap / RSS 的绝对地址 | CI 自动注入 |
| `VITE_BASE` | 静态资源前缀与 router basename | CI 自动注入 |
| `VITE_COMMENTS_API` | 留言后端地址；为空则全站不渲染留言区 | 仓库变量 `COMMENTS_API` |

## 页面与路由

顶栏与页脚的顺序只有一个来源：[`src/lib/nav.ts`](./src/lib/nav.ts)。两处各写一份时顺序会悄悄漂移，所以不在别处重复。

| 路径 | 页面 | 预渲染 | 说明 |
| --- | --- | --- | --- |
| `/` | Home | ✓ | 首屏 |
| `/me` | Me | ✓ | 个人页，带留言板（`scope=guest`） |
| `/notes` | Notes | ✓ | 笔记索引，筛选 / 主题 chips |
| `/notes/:slug` | NoteDetail | ✓ | 正文 + 目录 + 相关阅读 + 留言 |
| `/archive` | Archive | ✓ `noindex` | 归档已并进 `/notes`，这里只剩跳转页 |
| `/retro` · `/retro/:slug` | Retro / RetroDetail | ✓ | 复盘，额外带 period / role / stack / metrics |
| `/life` | LifeRoute | ✓ | 生活记录：上传即存本机 IndexedDB，`?id=` 看单条 |
| `/local` | LocalDoc | ✓ `noindex` | 本地文档阅读页，id 在 query 里 |
| `/import` | Import | ✓ | 拖入 markdown，存 IndexedDB |
| `/craft` | Craft | ✓ | ReactBits 效果展台 |
| `/about` | About | ✓ | 站点说明 |
| `*` | NotFound | 404.html | GitHub Pages 自动接管未知路径 |

## 目录结构

```
docs/                      设计规划与全站走查（DESIGN_PLAN / COMMENTS_AUDIT / PC_AUDIT / MOBILE_AUDIT）

content/
├─ notes/*.mdx             笔记：frontmatter + 正文
└─ retro/*.mdx             复盘：额外含 period / role / stack / metrics

src/
├─ App.tsx                 路由表（页面从 '@/pages' 取：浏览器拿 lazy 版，预渲染拿同步版）
├─ main.tsx                唯一入口，有预渲染内容时走 hydrate
├─ index.css               设计令牌 + 长文排版作用域
├─ assets/                 实拍素材（cloud / lotus 给 /craft 当背景）与工牌
├─ pages/
│  ├─ index.ts             懒加载版页面导出 + 路由 chunk 预热
│  ├─ index.eager.ts       同步版，仅预渲染构建使用（vite alias 切换）
│  └─ *.tsx                15 个页面文件（13 条路由；生活页另有列表 / 详情两个视图）
├─ components/
│  ├─ effects/             15 个效果组件（ReactBits 14 + 自研 ScrollBackdrop）
│  │                       + lanyardPhysics（纯物理，不碰 DOM）
│  ├─ layout/              SiteLayout / SiteNav / Footer / CommandPalette
│  ├─ notes/               NoteRow / RetroCard / Toc / ReadingProgress / ArchiveTimeline
│  │                       / RelatedReading / TopicPicker
│  ├─ comments/            CommentSection / CommentForm / CommentItem
│  ├─ mdx/                 Callout / DecisionCard / CodeBlock / registry
│  ├─ common/              SectionHeading / StatusDot / TagChip / PageWash
│  └─ ui/                  Button / Badge / Card / Dialog / Tabs / Tooltip
├─ lib/
│  ├─ content.ts           内容索引与内容类型（NoteStatus / TopicId / RetroMeta）
│  ├─ bodies.ts            正文懒加载版（浏览器）
│  ├─ bodies.eager.ts      正文同步版（预渲染）
│  ├─ meta.ts              路径 → title/description/canonical/JSON-LD
│  ├─ site.ts              站点常量与 URL 拼接
│  ├─ nav.ts               导航顺序的唯一来源
│  ├─ tone.ts              主题 → 色相、页面环境色
│  ├─ theme.ts             主题状态（首帧由 index.html 内联脚本决定）
│  ├─ comments.ts          留言数据层（fetch + 两种身份）
│  ├─ lifeStore.ts         生活记录（本机 IndexedDB，预留云端接口）；momentPhoto.ts 画缺图占位
│  ├─ lifeSeed.ts          六条示例记录（随站点打包，首次打开时装进本机库）
│  ├─ idb.ts               IndexedDB 的共享连接（docs + moments 两个 store）
│  ├─ localDocs.ts         本地文档：IndexedDB，不上传
│  ├─ markdown.ts          运行时 markdown 渲染（只服务导入的文档）
│  ├─ routeTransition.ts   View Transitions 封装（含 chunk 预热等待）
│  └─ utils.ts             cn() 等
└─ hooks/                  7 个：useActiveSection / useDocumentMeta / useEntryRows
                           / useLifeEntries / useLocalDocs / useMediaQuery / usePrefersReducedMotion

prerender/entry.tsx        预渲染入口：render(url) + getStaticPaths + headFor + feed
scripts/prerender.mjs      渲染每个路由、注入 head、生成 404 / sitemap / rss / robots
scripts/lanyard-feel.ts    工牌手感的数值测试台（60fps 跑完拖拽与甩动，打表看参数）
smoke/entry.tsx            渲染冒烟：抓运行时崩溃，不只抓类型错误
worker/                    留言后端：Cloudflare Worker + D1（见 worker/README.md）
public/                    favicon / og.png / _headers / .nojekyll
.github/workflows/deploy.yml  推 main 即构建发布到 GitHub Pages
```

一份约定：CSS 与组件同目录（`Xxx.tsx` + `Xxx.css`），不走 CSS Modules —— 效果组件依赖全局变量与 `data-theme` 级联，作用域化反而要绕。

## 内容模型

**笔记**（`content/notes/*.mdx`，文件名即路由 `/notes/xxx`）

1. 填 frontmatter：`title / date / updated / topic / tags / status / summary`，缺一不可；
2. 正文里 `##` `###` 会自动进入左侧目录，锚点由构建期插件生成（`slugify` 与 rehype-slug 对齐）；
3. 需要结构化提示时用 `<Callout type="decision | warn | unverified">`。

`topic` 不是学科分类，而是这个站的建设分层，**顺序即施工顺序**：

| 值 | 层级 | 覆盖 |
| --- | --- | --- |
| `structure` | 结构 | 路由与导航、组件层、目录拆分 |
| `styling` | 样式 | Tailwind v4 接入、设计令牌、主题切换 |
| `content` | 内容 | MDX 构建期索引、本地文档导入 |
| `reading` | 阅读 | 行宽、目录、进度条、相关阅读 |
| `motion` | 动效 | 效果预算、滚动背景序列 |
| `delivery` | 交付 | 预渲染、子路径部署、留言后端 |

新增一层时要同时改四处：`TopicId` 与 `topicLabels`（`lib/content.ts`）、`topicTone`（`lib/tone.ts`）、`lib/localDocs.ts` 的白名单、以及 `index.css` 里两套主题各一个色相变量。

`status` 是 `seedling` / `growing` / `evergreen`，它是这套外脑的灵魂 —— 让"这篇还没想清楚"变成一个体面的状态，而不是藏着不写。

**复盘**（`content/retro/*.mdx`）在同样字段之外多四行：`period`（时间段）、`role`（角色）、`stack`（技术栈数组）、`metrics`（JSON 数组，`{label, before, after}` 三件套）。

**生活**既不是 mdx，也不是渲染时读的数组：记录由站主在页面上传，照片先压到 1600 宽，再连同文字一起存进这台设备的 IndexedDB（与导入文档共用一个库，版本由 `lib/idb.ts` 统一管）。地址统一成 `/life?id=xxx` —— 记录本来就不可分享，用不了分层路径。数据层是 `LifeSource` 接口，现在只有本机实现，接云端只需换掉 `lifeStore.ts` 末尾那一行。

`lib/lifeSeed.ts` 里另有六条示例：图随站点打包，**首次打开时**由 `seedIfEmpty` fetch 成 Blob 写进同一个 store，之后和自己传的没有区别（能点开、能删、删了不再长出来 —— 靠 localStorage 的一个标记，而不是靠「库为空」判断，否则删光后刷新会全部复活）。所以界面上要分清：示例谁都看得见，你加上的只有这台设备看得见。

**导入的文档**只存在这台设备的 IndexedDB，没有账号、没有上传接口 —— 所以它走的是另一条渲染路径：`lib/markdown.ts` 手写的运行时渲染器，只被 `/import` 与 `/local` 两个路由引用，独立分包。

## 留言后端

主站是纯静态的 GitHub Pages，没有服务端，所以留言落在 `worker/`：一个 Worker + 一张 D1 表，覆盖「列 / 写 / 下架」，一律软删。

前端只在 `VITE_COMMENTS_API` 非空时挂载留言组件 —— 地址没配的表现是"什么都没有"，不是"一个永远转圈的空框"。

默认匿名可发（`X-Client-Id` 是 localStorage 里的 UUID，服务端只拿它判断"这条是不是你写的"）；GitHub 登录是可选项，运行时读 `/api/config` 决定入口是否渲染，前端不需要为此重新部署。部署步骤见 [`worker/README.md`](./worker/README.md)。

## 效果预算

ReactBits 的效果是素材，不是风格。四条红线（详见 `docs/DESIGN_PLAN.md` §4）：

1. 一屏最多一个常驻动效；
2. 阅读页零装饰动效（只有 2px 进度条）；
3. 效果必须承重，否则只能在 `/craft` 当展品；
4. 时长统一走 `--motion-fast/base/in`，`prefers-reduced-motion` 下退化为静态首帧。

改手感类的参数（工牌的弹簧、阻尼、绳长）先跑 `node scripts/lanyard-feel.ts` 看表，再去浏览器里确认视觉 —— 无头浏览器里 rAF 基本不推进，截图看不出跟手滞后。

## 预渲染

纯客户端渲染的站，HTML 里只有一个空 `<div id="root">`：搜索引擎拿到空页、分享链接没有摘要、RSS 无法生成。所以这个站在构建期把每个路由渲染成真正的 HTML。

三条硬约束，改动时不要绕过：

**1. 必须用同步的 `renderToString`**

`renderToPipeableStream` / `prerenderToNodeStream` 看起来更"现代"，但它们是给流式首屏设计的：一旦某个 Suspense 边界被判定 pending，就会输出

```html
<template id="B:0"></template><div aria-busy="true"></div>
...
<div hidden id="S:0">真正的正文</div>
<script>$RC("B:0","S:0")</script>
```

浏览器执行脚本后正常，**爬虫看到的是空壳**。实测同一棵树流式渲染 7 个页面里 5 个分块，`renderToString` 全部 0 分块，且保留了 `<!--$-->` 边界注释，hydration 结构一致。

**2. 预渲染路径上不能有 `React.lazy`**

`react-router` 的 `<Outlet>` 配合 Suspense 时，lazy 组件会让边界 pending。所以 `vite.config.ts` 在 `--mode ssr` 时把两个模块 alias 到同步版本：

| 模块 | 浏览器 | 预渲染 |
| --- | --- | --- |
| `@/pages` | `index.ts`（lazy） | `index.eager.ts`（同步） |
| `@/lib/bodies` | `bodies.ts`（lazy） | `bodies.eager.ts`（同步） |

`App.tsx` 只有一份，不需要为两种渲染各维护一套路由。

**3. 构建时间必须是常量**

`__BUILD_DATE__` / `__BUILD_TIME__` 由 `vite.config.ts` 的 `define` 注入。原先这几处是模块作用域 `new Date()`，会在**用户浏览器里**重新求值，导致「构建于 X 日」「最近更新 N 天前」与服务端不一致，React 报 hydration mismatch。

预渲染脚本里有三道拦截，任何一道不过就构建失败（而不是安静地发布空页面）：出现 Suspense 占位块、出现骨架 `aria-busy`、正文少于 200 字符（`noindex` 页除外，跳转页本来就没什么字）。

路由清单只有一处：[`prerender/entry.tsx`](./prerender/entry.tsx) 的 `getStaticPaths()`，由内容索引推导。`noindex` 的条目（`/archive`、`/local`）照样产出 HTML，只是不进 sitemap —— 没有真实文件的话直接访问会 404。

## 部署（GitHub Pages）

仓库自带 `.github/workflows/deploy.yml`：推到 `main` 就自动构建并发布，本地不需要跑构建。CI 会先跑 `typecheck` 与 `lint`，用 `npm ci` 而不是 `install`（lockfile 与 `package.json` 不一致时应当直接失败）。

### 首次上线

1. 在 GitHub 新建**空仓库**（不要勾选初始化 README，否则和本地历史冲突）
2. 关联远程并推送：

```bash
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

3. 打开仓库 **Settings → Pages**，把 **Source** 设为 **GitHub Actions**
4. 等 Actions 变绿，地址是 `https://你的用户名.github.io/仓库名/`

### 不需要手写域名和路径

workflow 用 `actions/configure-pages` 读出 Pages 的配置，把两个值注入构建：

| 变量 | 来源 | 用途 |
| --- | --- | --- |
| `VITE_SITE_URL` | `base_url` | canonical / `og:url` / sitemap / RSS 的绝对地址 |
| `VITE_BASE` | `base_path` | 静态资源前缀与 router basename |

所以**仓库改名、以后换绑自定义域名，都不用改代码**。仓库叫 `用户名.github.io` 时站点在根路径，其他名字自动部署到 `/仓库名/` 子路径 —— 两种都能跑，不需要手动设 `base`。

### 本地验证子路径构建

```bash
VITE_SITE_URL=https://用户名.github.io/仓库名 VITE_BASE=/仓库名/ npm run build
```

> 在 Git Bash 里直接写 `VITE_BASE=/仓库名` 会被 MSYS 当成路径转换成 `D:/...`，写进 `.env.local` 更稳（该文件已被 git 忽略）。CI 跑在 Linux 上，没有这个问题。

### 其他平台

产物是纯静态目录，`dist/` 原样托管即可：Cloudflare Pages / Netlify 填构建命令 `npm run build`、输出目录 `dist`，`public/_headers` 自动生效；Vercel 要把 header 搬进 `vercel.json`。

GitHub Pages 没有自定义响应头的能力，`_headers` 在那边会被忽略 —— 保留它只是为了将来换平台时能直接用。

### 上线后自检

```bash
curl -sI https://你的地址/notes/<某篇>/ | head -1          # 200
curl -s https://你的地址/notes/<某篇>/ | grep '<title>'    # 文章标题，不是站点名
curl -s https://你的地址/sitemap.xml | head -3
```

`dist/404.html` 已生成，GitHub Pages 会自动用它接管未知路径。

## 技术要点

- **内容索引在构建期生成**：`vite.config.ts` 里的 `contentIndex()` 插件产出虚拟模块 `virtual:content-index`，列表页只拿元数据（~6KB），正文按篇懒加载。
- **代码高亮在构建期完成**：shiki 双主题，输出 `--shiki-dark` / `--shiki-light`，CSS 按 `data-theme` 取用，浏览器端零高亮开销。
- **主题切换零 JS 级联**：语义变量在 `:root` / `[data-theme=light]`，`@theme inline` 把它们映射成工具类。主题状态用 `useSyncExternalStore` 读 `<html data-theme>`，单一真相、无 hydration 抖动。
- **标题只在一处维护**：`src/lib/meta.ts` 的 `resolveMeta(pathname)` 同时被客户端 `useDocumentMeta` 和预渲染脚本使用，浏览器标签和爬虫看到的必然一致。
- **路由过渡不截白帧**：`pages/index.ts` 在指针扫过链接时预热 chunk，`routeTransition.ts` 等它就绪（上限 320ms）再 `startViewTransition` —— 宁可少一次过渡，也不能让点击没反应。
- **`npm run smoke`**：用 SSR 渲染每个页面与 MDX 正文，能在不打开浏览器的情况下抓到"类型通过但渲染崩溃"的问题。
