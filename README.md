# 学习外脑

技术笔记与项目复盘的聚合站。定位是**双层的**：内容层沉淀工程判断，呈现层用界面细节证明审美能力。

规划文档见 [`DESIGN_PLAN.md`](./DESIGN_PLAN.md)（含信息架构、设计系统、效果预算与验收标准）。

## 快速开始

```bash
npm install
cp .env.example .env    # 填上 VITE_SITE_URL，否则 canonical/sitemap 里是 localhost
npm run dev             # 开发服务器
npm run build           # 类型检查 + 客户端构建 + 预渲染 + sitemap/RSS
npm run typecheck       # 仅类型检查
npm run lint            # ESLint
npm run smoke           # SSR 渲染冒烟：8 个页面 + 2 篇 MDX
```

`npm run build` 实际是四步：

```
tsc -b                  →  类型检查，不通过就不构建
vite build              →  客户端产物（带 hash 的资源）
vite build --ssr ...    →  预渲染用的服务端入口
node scripts/prerender  →  逐路由渲染成 HTML，并生成 sitemap / rss / robots
```

产物里每个路由都有自己的 `index.html`，**正文直接写在 HTML 里**，不依赖 JS 执行。

## 目录结构

```
content/
├─ notes/*.mdx            笔记：frontmatter + 正文
└─ retro/*.mdx            复盘：额外含 period / role / stack / metrics

src/
├─ App.tsx                路由表（页面从 '@/pages' 取：浏览器拿 lazy 版，预渲染拿同步版）
├─ main.tsx               唯一入口，有预渲染内容时走 hydrate
├─ pages/
│  ├─ index.ts            懒加载版页面导出
│  ├─ index.eager.ts      同步版，仅预渲染构建使用（vite alias 切换）
│  └─ *.tsx               8 个路由页面
├─ components/
│  ├─ effects/            ReactBits 效果 + Reveal / AuroraBackdrop
│  ├─ layout/             SiteNav / Footer / SiteLayout / CommandPalette
│  ├─ mdx/                Callout、DecisionCard、组件映射
│  ├─ notes/              NoteRow / RetroCard / Toc / ReadingProgress
│  ├─ common/             SectionHeading / StatusDot / TagChip
│  └─ ui/                 Button / Badge / Card / Dialog / Tabs / Tooltip
├─ lib/
│  ├─ content.ts          内容索引 + 正文组件
│  ├─ bodies.ts           正文懒加载版（浏览器）
│  ├─ bodies.eager.ts     正文同步版（预渲染）
│  ├─ meta.ts             路径 → title/description/canonical/JSON-LD
│  ├─ site.ts             站点常量与 URL 拼接
│  └─ theme.ts            主题状态（首帧由 index.html 内联脚本决定）
├─ hooks/                 useActiveSection / usePrefersReducedMotion / useDocumentMeta
└─ index.css              设计令牌 + 长文排版作用域

prerender/entry.tsx       预渲染入口：render(url) + getStaticPaths + headFor
scripts/prerender.mjs     渲染每个路由、注入 head、生成 404 / sitemap / rss / robots
smoke/entry.tsx           渲染冒烟：抓运行时崩溃，不只抓类型错误
```

## 写一篇笔记

1. 在 `content/notes/` 新建 `xxx.mdx`，文件名即路由 `/notes/xxx`；
2. 填 frontmatter（`title / date / updated / topic / tags / status / summary` 缺一不可）；
3. 正文里 `##` `###` 会自动进入右侧目录，锚点由构建期插件生成；
4. 需要结构化提示时用 `<Callout type="decision | warn | unverified">`。

`status` 是必填字段：`seedling` / `growing` / `evergreen`。它是这套外脑的灵魂——让"这篇还没想清楚"变成一个体面的状态，而不是藏着不写。

## 效果预算

ReactBits 的效果是素材，不是风格。四条红线（详见 `DESIGN_PLAN.md` §4）：

1. 一屏最多一个常驻动效；
2. 阅读页零装饰动效（只有 2px 进度条）；
3. 效果必须承重，否则只能在 `/craft` 当展品；
4. 时长统一走 `--motion-fast/base/in`，`prefers-reduced-motion` 下退化为静态首帧。

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

预渲染脚本里有三道拦截，任何一道不过就构建失败（而不是安静地发布空页面）：出现 Suspense 占位块、出现骨架 `aria-busy`、正文少于 200 字符。

## 部署

产物是纯静态目录，`dist/` 原样托管即可。

```bash
VITE_SITE_URL=https://your-domain.com npm run build
```

**上线前必须设 `VITE_SITE_URL`**，它决定 canonical、`og:url`、sitemap、RSS 里的绝对地址。没设时构建会打印警告，产物里写的是 `localhost`。

| 平台 | 配置 |
| --- | --- |
| Cloudflare Pages / Netlify | 构建 `npm run build`，输出目录 `dist`；`public/_headers` 自动生效 |
| Vercel | 同上，但 `_headers` 不生效，需在 `vercel.json` 里配 header |
| GitHub Pages | 子路径部署（`user.github.io/repo/`）需额外在 `vite.config.ts` 设 `base`，并让 `SITE.url` 带上子路径 |

`dist/404.html` 已生成，托管平台会用它接管未知路径。

上线后自检：

```bash
curl -s https://your-domain.com/notes/<某篇> | grep '<title>'   # 应是文章标题，不是站点名
curl -sI https://your-domain.com/notes/<某篇> | head -1          # 200
curl -s https://your-domain.com/sitemap.xml | head -3
curl -s https://your-domain.com/rss.xml | head -5
```

## 技术要点

- **内容索引在构建期生成**：`vite.config.ts` 里的 `contentIndex()` 插件产出虚拟模块 `virtual:content-index`，列表页只拿元数据（~6KB），正文按篇懒加载。
- **代码高亮在构建期完成**：shiki 双主题，输出 `--shiki-dark` / `--shiki-light`，CSS 按 `data-theme` 取用，浏览器端零高亮开销。
- **主题切换零 JS 级联**：语义变量在 `:root` / `[data-theme=light]`，`@theme inline` 把它们映射成工具类。主题状态用 `useSyncExternalStore` 读 `<html data-theme>`，单一真相、无 hydration 抖动。
- **标题只在一处维护**：`src/lib/meta.ts` 的 `resolveMeta(pathname)` 同时被客户端 `useDocumentMeta` 和预渲染脚本使用，浏览器标签和爬虫看到的必然一致。
- **`npm run smoke`**：用 SSR 渲染每个页面与 MDX 正文，能在不打开浏览器的情况下抓到"类型通过但渲染崩溃"的问题。

