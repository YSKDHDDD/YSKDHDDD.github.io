# 站点规划 · 学习外脑 + 审美展示

## 0. 一句话定位

> 一个把**技术笔记**和**项目复盘**长期沉淀下来的个人外脑；它本身就是我的作品，用页面细节证明我关注可读性、可维护性和界面品质。

两条诉求不是两个站点，而是同一件事的两面：**外脑是内容，审美是内容的表现形式**。所以不做"博客 + 作品集"两套皮肤，让内容页的质量成为最强的作品。

## 1. 三条设计原则

**① 外脑即作品**
首页不放"炫技 demo 墙"，而是让人 10 秒内看到：我在持续输入、我的笔记有结构、我知道自己在优化什么。

**② 渐进披露**
列表默认只给"时间 + 标题 + 领域 + 时长"，摘要 hover 才展开；工艺页默认只给静帧，交互后才跑动效。密度优先，细节按需出现。

**③ 细节必须可验证**
不用"注重细节"这种形容词，改用可检查的东西：字阶表、间距表、动效时长、对比度、Lighthouse 分数、构建体积。工程化思维体现在约束，而不是口号。

## 2. 信息架构

| 路由 | 页面 | 核心任务 |
| --- | --- | --- |
| `/` | 首页 | 定位 + 四段聚合（现在 / 笔记 / 复盘 / 工艺） |
| `/notes` | 笔记库 | 按主题与成熟度筛选，密度优先 |
| `/notes/[slug]` | 笔记详情 | 长文阅读体验，全站审美主战场 |
| `/retro` | 复盘列表 | 卡片流，突出"问题 → 决策 → 结果" |
| `/retro/[slug]` | 复盘详情 | 决策卡片式结构化叙事 |
| `/craft` | 工艺展示 | 效果陈列 + 设计系统说明 |
| `/about` | 关于 | 能力、经历、联系方式 |
| `⌘K` | 全局命令面板 | 跨页搜索笔记、复盘、效果 |

**导航形态的判断：不要用 Dock。** Dock 是 macOS 的隐喻，适合"应用切换"，而站点是"阅读 + 检索"。全站导航用顶部极简栏（logo + 3 个链接 + ⌘K + 主题切换），Dock 降级为 `/craft` 页的一个展品。这是产品判断，也避免读者在长文里被底部浮层干扰。

## 3. 页面骨架

### 3.1 首页

```
顶部导航（滚动后 64px → 48px，加分隔线）
├─ Hero           定位一句话 + 两个 CTA ｜ 右侧"活的细节"卡
├─ 01 现在        3 张卡：正在读 / 正在写 / 正在搭
├─ 02 最近笔记    列表，5 条，行内 hover 展开摘要
├─ 03 精选复盘    2 张卡，封面 + 关键指标（周期 / 技术栈 / 一个数字）
└─ 04 工艺        4 个效果缩略，点击进 /craft
页脚             RSS / GitHub / 邮箱 / 版本号 / 构建时间
```

- Hero 左侧占 60%，文案限两行：`做什么` + `怎么做`。标题保留 `DecryptedText`（现有资产），背景换成 `SoftAurora`。
- 右侧"活的细节"卡：最近一次 git 提交信息、当前在读的书、本月新增笔记数。**数据是真的，才叫细节。**
- "现在"这一段成本极低但收益极高：它证明站点还在活着，不是三年前的静态作品集。

### 3.2 笔记索引 `/notes`

- 顶部一行统计：`共 N 篇 · M 个主题 · 最近 X 天更新`。
- 左侧筛选（sticky）：主题 chips + 成熟度图例（seedling / growing / evergreen）。
- 右侧列表：`日期 ｜ 标题 ｜ 领域 ｜ 时长`，行高 44px，hover 整行右移 2px + 出现箭头。
- 移动端：筛选收进顶部横向滚动 chips。
- **不做卡片瀑布流**——卡片会牺牲密度，200 篇之后就没法用了。

### 3.3 笔记详情 `/notes/[slug]`

三栏：`目录 130px ｜ 阅读列 680px ｜ 元信息 104px`。

- 顶部 2px 阅读进度条；导航退化为 `← 笔记库`。
- 目录 sticky，随滚动高亮（复用现有 `useActiveSection`）。
- 阅读列：中文正文 17px / 行高 1.8 / 段距 1.2em，680px ≈ 每行 34–38 个汉字。
- 代码块：shiki 双主题、文件名标签、行号、一键复制、可高亮单行。
- Callout 三种：`决策`（琥珀）/ `注意`（红）/ `待验证`（蓝）。**"待验证"是必杀细节**——它展示你知道自己哪里还不确定。
- 文末：参考文献、修订记录（取自 frontmatter 的 updated + 可选的 changelog）、上一篇 / 下一篇。

### 3.4 复盘详情 `/retro/[slug]`

固定四段结构，任何人扫一眼就知道要点：

```
元信息条：周期 ｜ 角色 ｜ 技术栈 ｜ 规模
1. 问题与约束      当时面对什么，不能动什么
2. 关键决策        决策卡片 × N
3. 结果            指标变化（前 → 后）
4. 如果重来        我会改哪一件事
```

**决策卡片**是这一页的原创排版元素：`选项 A / 选项 B` 并列 → 选了什么 → 为什么 → 代价是什么。它比大段叙述更能体现工程判断。

### 3.5 工艺展示 `/craft`

- 上半：4 个效果各一格，静帧 + 名称 + 一句"用了什么技术、为什么这么做"。
- 下半 `#design-system`：把设计令牌可视化 —— 色板、字阶、间距标尺、动效曲线（可点播）。
- 页尾彩蛋：Dock 作为"一个组件"出现，可交互。

### 3.6 关于 `/about`

- 不写自传体长文。三段式：`我在做什么` / `我擅长什么（带证据链接）` / `怎么联系我`。
- 能力项必须挂链接：说"熟悉 TypeScript"，就链到对应的复盘或笔记。

## 4. 效果预算：什么叫"适当融入"

ReactBits 的效果是**素材**，不是风格。如果每个区块都挂一个动效，站点的叙事就从"我关心可读性"变成"我收藏了很多组件"。所以先定四条红线：

1. **一屏最多一个常驻动效**（自己会动的）。其余只能是**触发式**：hover、滚动进入、点击。
2. **阅读页零装饰动效**。随滚动变化的只有顶部 2px 进度条，其余一律静止。
3. **效果必须承重**：要么承担信息（进度 / 状态 / 检索 / 可点击性），要么在 `/craft` 里被明确标注为展品。纯装饰动画不许出现在首页和列表页。
4. **统一走 motion token**（120 / 220 / 400ms）。`prefers-reduced-motion` 下退化为**静态首帧**，不是"变快"。

### 预算表

| 位置 | 效果 | 承担什么 | 实施约束 |
| --- | --- | --- | --- |
| 首页 Hero 背景 | `SoftAurora` | 第一印象：这是个人站，不是模板 | 全站唯一常驻动效。Canvas 在 `requestIdleCallback` 后挂载，opacity `.55`，底部渐隐进正文 |
| Hero 标题 | `DecryptedText` | "外脑"的隐喻：把知识解析出来 | 只作用于**一个词**，每 7s 触发一次；不整句闪烁 |
| 首页 / 列表入场 | `Reveal`（IntersectionObserver） | 建立分段阅读节奏 | `translateY(8px)` + 220ms，一次性触发不重复；位移小到几乎察觉不到"在动" |
| 笔记行 hover | 纯 CSS | 可点击性 | 右移 2px + 箭头淡入 + 底色微亮，120ms，0 JS |
| `⌘K` 命令面板 | `Dialog` + `backdrop-blur` + 60ms stagger | 检索本身就是功能展示 | 全键盘可达，Esc 关闭，结果即时过滤 |
| 路由切换 | `View Transitions` | 导航反馈：让"换了一页"这件事有物理感 | 旧页 120ms 退、新页 220ms 进（不是 400ms —— 切页要利落）。chunk 未预热时**跳过过渡**而不是截到 Suspense 白屏；`prefers-reduced-motion` 下完全不启动 |
| `/craft` | `Dock` / `ScrollExpand` / `GradientWaves` | 展品 | 默认**静帧**，hover / focus / 点击后才跑；每格标注"用了什么、为什么" |
| `/craft` 交互展位 | `TiltCard` / `MagneticButton` / `GlowBorder` | 展品 | 前两个指针驱动、hover 才动；`GlowBorder` 是常驻的，但只在展位里跑。三者都不得出现在列表页或阅读页 |
| `/me` 首屏 | `LanyardBadge` | 身份：工牌是可抓的，不是一行"你好，我是…" | 物理在 `lanyardPhysics.ts`（可脱离 DOM 逐帧跑，`scripts/lanyard-feel.ts` 出数字）：牵引式拖拽、松手会甩、摆角是欠阻尼弹簧，**静止即停帧**；`md` 以下不挂载（首屏没位置，会被常驻 Dock 切半）；`prefers-reduced-motion` 下不启动循环；有照片时是**双面卡**——正面整幅照片、背面才是信息，点一下翻面（位移过 6px 算拖拽，不判时长），翻面放在卡里另一层 `.lanyard__flip`，因为卡的 `transform` 每帧被物理重写；照片 560×868 webp（62KB）、`loading=lazy`，窄屏卡不挂载也就不会下载 |
| `/me` 收尾 | `DecayCard` | 告别：一张会散开的图，比再加一行链接有分量 | WebGL2 噪声域扭曲（simplex 叠成湍流推开采样坐标）。画布**等于**卡面 —— 原版留 1.24 倍画布、内容再内缩 8.33%，图比卡小一圈；纵向设计尺寸按实际宽高比推（`uCardH`），不再写死 4:5。指针速度决定撕裂、停下 0.55s 合回；中心只给 12% 位移，光点与圆环保持可读，烂掉的是轮廓；`scope=card`，页面别处的鼠标不该动它；`prefers-reduced-motion` 下不建 GL，就是一张静态图；`lg` 以下不挂载（触屏没有「指针速度」这个输入，也省掉 10KB）；图是中段那张抽象封面的**竖幅重排**（600×800 webp，10KB）—— 同色系、不同构图，全页同一张脸只出现一次 |
| 404 | `GradientWaves` | 稀缺点位 | 全屏，一年见一次 |
| 阅读页 | 无 | — | 只有进度条与 TOC 高亮 |

### 明确不做

不做光标跟随光斑、不做全站粒子背景、不做列表 3D 卡片倾斜、不给每个元素都加 fade-in —— 逐条 stagger 会让页面读起来像"一直在加载"。**克制本身就是审美的一部分，而且是最难被抄走的那部分。**

唯一的例外是 `/craft` 的展位：3D 倾斜、磁吸、流光边框都放在那里，因为那一页的定位就是"展厅"。展品的正当性来自**位置**，不来自效果本身 —— 同一个 `TiltCard` 放在笔记列表里就是噪音，放在 `/craft` 里就是证据。

## 5. 设计系统

### 栅格
- 12 列，gutter 24px。
- 容器：列表 / 工艺 `max-w-[1120px]`；阅读 `max-w-[680px]`；首页 hero `max-w-[1180px]`。
- 断点：`sm 640 / md 768 / lg 1024 / xl 1280`。

### 字阶（ratio ≈ 1.23，全部落到 Tailwind token）
| 用途 | 字号 | 行高 | 字重 |
| --- | --- | --- | --- |
| 正文 | 17px | 1.8 | 400 |
| 次级说明 | 13px | 1.6 | 400 |
| 小标签 | 11px | 1.4 | 500 + 0.02em 字距 |
| h3 | 20px | 1.5 | 500 |
| h2 | 25px | 1.35 | 500 |
| h1 | 31px | 1.2 | 500 |
| Hero | 49px | 1.1 | 500 |

只保留 **400 / 500** 两个字重。中文环境加 700 会显脏。

### 间距
4 的倍数；段间 24，块间 48，区块间 96（移动端 64）。

### 色彩
> 2026-10-29 修订：原先全站只有一个几乎不出现的靛蓝，被指"太单调"。改成
> **冷底 + 三个色相**的分工制，见 §14。

- 深色底 `#090c15`（不用纯黑），卡片 `#101623`，边框 `rgba(255,255,255,.085)`。
- 正文 `#e9ebf3`，次要 `#9ba5ba`，弱化 `#6b7488`。
- 品牌是**两个端点**：`--brand #7b6cff` → `--brand-2 #3ea6ff`，用在按钮、导航下划线、
  页脚分隔线、区块编号。渐变不是装饰，是"这属于同一个系统"的证据。
- 主题色三枚，只用于**标签级**元素（主题筛选、行尾主题名、复盘卡角标）：
  工程 `#4d8dff`、设计 `#f472b6`、工具链 `#2dd4bf`。
- 语义色沿用三个：决策 `#ffb224`、注意 `#ff6161`、常青 `#34d399`。
- 每页顶部的 `PageWash`：两层色团 + 一层宽色带，`fixed` + `z-index:-1`，
  用 `mask-image` 渐隐到 `--bg`。纯 CSS，零请求、零 JS。
- 浅色主题同结构、同色相，饱和度与明度各压一档（例：工程色 `#1d5fd0`）。

### 圆角与边框
`8 / 12 / 20` 三档；边框统一 1px 半透明，不用重阴影，只用 `0 1px 2px rgba(0,0,0,.04)` 级别的功能阴影。

### 动效
| 场景 | 时长 | 曲线 |
| --- | --- | --- |
| 微交互（hover、focus） | 120ms | `cubic-bezier(.2,.8,.2,1)` |
| 状态切换（主题、展开） | 220ms | 同上 |
| 入场 / 页面切换 | 400ms | `cubic-bezier(.16,1,.3,1)` |

只动 `transform` 和 `opacity`；`prefers-reduced-motion` 下全部关闭。**时长写进 token，不散落在组件里。**

## 6. 内容模型

`content/notes/*.mdx` 与本文件同构：

```yaml
---
title: 从 13 个类型错误里读出的结构问题
slug: reactbits-audit
date: 2026-10-27
updated: 2026-10-27
topic: engineering          # engineering | design | tooling
tags: [typescript, tailwind, refactor]
status: evergreen           # seedling | growing | evergreen
readingTime: 8
summary: Tailwind 从未安装、白屏的三个根因，以及为什么"假组件"比 bug 更贵。
---
```

`content/retro/*.mdx` 增加 `period / role / stack / metrics`；`metrics` 是 `前 → 后` 的键值对，直接渲染成结果表格。

`status` 是全站的灵魂字段：它让"长期维护"这件事变得可见，也给了未完成笔记一个体面的入口。

## 7. 组件清单

**新增**：`SiteNav`、`ThemeToggle`、`CommandPalette`、`Footer`、`SectionHeading`（带 01/02 编号）、`NoteRow`、`RetroCard`、`TagChip`、`StatusDot`、`ReadingProgress`、`Toc`、`Prose`（排版作用域）、`Callout`、`CodeBlock`、`DecisionCard`、`CraftTile`、`EmptyState`

**复用现有**：`Button`、`Card`、`Badge`、`Tabs`、`Tooltip`、`Dialog`、`cn()`

**改造（受 §4 预算表约束）**：`DecryptedText`（Hero 单个关键词）、`SoftAurora`（Hero 背景，懒挂载）、`Dock`（`/craft` 页尾展品）、`GradientWaves`（`/craft` 展位 + 404 背景）、`ScrollExpand`（`/craft` 展位，默认静帧）

**新增效果层**：`Reveal`（IO 入场，唯一被允许出现在列表页的动效）、`AuroraBackdrop`（SoftAurora 的懒加载包装，负责 reduced-motion 与 idle 调度）

## 8. 现有资产迁移映射

| 现有 | 去向 |
| --- | --- |
| `sections/HeroSection.tsx` | `/` Hero，背景换 SoftAurora，标题保留 DecryptedText |
| `sections/WavesSection.tsx` | `/craft` 的 GradientWaves 展位 |
| `sections/ShowcaseSection.tsx` | `/craft` 的 ScrollExpand 展位 |
| `sections/ComponentsSection.tsx` | `/craft#design-system` |
| `components/layout/DockNav.tsx` | 顶部导航取代；Dock 本身移入 `/craft` 页尾 |
| `data/navigation.ts` | 从"页面内分区"改为"站内路由表" |
| `hooks/useActiveSection.ts` | 阅读页 TOC 高亮直接复用 |
| `lib/utils.ts` / `ui/*` | 原样保留，是设计系统页的展示素材 |

## 9. 技术方案

- **路由**：`react-router-dom` v7，含滚动位置恢复与 404。
- **内容**：MDX（`@mdx-js/rollup`）+ `remark-gfm` + `rehype-slug` + `rehype-autolink-headings` + `rehype-pretty-code`（shiki 双主题）。用 MDX 是因为 Callout / 决策卡片要在正文里当组件用。
- **目录**：构建期从 MDX 抽出 heading 结构生成 JSON，不在浏览器里解析 HTML。
- **搜索**：构建期生成轻量索引（标题 / 摘要 / 标签），`⌘K` 用 `fuse.js` 本地检索，不发请求。
- **字体**：拉丁用 Inter var，中文用系统字体栈（PingFang / 微软雅黑），等宽用 JetBrains Mono。**不加载中文字体包**，几十 MB 不值得。
- **SEO**：每页独立 title / description / OG 图；构建期产出 RSS 与 sitemap。

## 10. 分期计划

### P0 · 骨架（先让结构立起来）
路由 + `SiteNav` + 首页四段静态内容 + 容器/字阶/间距/色彩 token 落进 `@theme` + §4 预算表里的 Hero 两个效果（SoftAurora / DecryptedText）与 `Reveal`。

### P1 · 内容管道（让外脑能装东西）
MDX 管线 + 3 篇真实笔记（建议就用本次审计过程）+ 索引页 + 详情页 + TOC / 进度条 / 代码块 / Callout。

### P2 · 检索与状态
标签筛选 + 成熟度图例 + `⌘K` + 空状态 + 复盘详情页。

### P3 · 细节打磨
主题切换（View Transitions）+ `/craft` 设计系统页 + 动效 token 统一 + RSS / OG + 性能与无障碍审计。

## 11. 验收标准（可量化，不靠感觉）

- Lighthouse：Performance ≥ 95，Accessibility 100，Best Practices 100
- 首屏 JS ≤ 150KB（gzip）；阅读页正文不依赖 JS 渲染
- 阅读列 680px，每行 34–38 汉字，正文 17px / 1.8
- 键盘可达：导航、主题切换、⌘K、目录跳转全程不用鼠标
- 正文对比度 ≥ 7:1，次要文字 ≥ 4.5:1
- `tsc -b` 与 `eslint .` 均 0 错误；全站无 `any`、无 `@ts-nocheck`
- 每篇笔记都有 `updated` 与 `status`，列表按 `updated` 倒序
- 375px 宽度下无横向滚动

## 12. 实施状态（2026-10-27）

P0 / P1 / P2 / P3 已全部落地，路由、内容管线、检索、工艺页均可运行。`tsc -b`、`eslint .`、`npm run build`、`npm run smoke` 四项为 0 错误。

### 与原计划的三处偏离

不是缩水，是实施时发现原方案有更好的解，逐条说明：

| 位置 | 原计划 | 实际做法 | 原因 |
| --- | --- | --- | --- |
| 笔记行摘要 | hover 才展开 | 常显一行，13px 弱化色截断 | 展开动画要么动 `height`（违反"只动 transform"），要么预留空白高度。常显一行密度不变，还少一个动效 |
| 正文字体 | Inter var + 系统中文栈 | 全部用系统栈 | Google Fonts 在中文网络下不稳定，Inter 也只省 0 点几毫秒。**零外部请求**比"看起来更专业"重要 |
| `/craft` 的 ScrollExpand | 作为一个展位 | 保留展位但标注"未嵌入" | 它需要一个很长的滚动距离才能演示完整过程，在 320px 高的格子里只会得到一帧。**不为了展示而展示**本身就是这条工艺的论点 |

### 内容管线比计划更进一步

原计划是"MDX + 构建期抽 TOC"，实际做成了**虚拟模块索引**：

```text
构建期                                       运行期
content/**.mdx ──► virtual:content-index ──► 列表页只读索引（~6KB）
                └─► 每篇一个 chunk ──────► 详情页才加载正文
```

首屏 JS 从一体化打包的 591KB 降到 **110KB（gzip）**，正文按篇懒加载，工艺页的着色器也在空闲后才拉取。

### 验收对照

| 项 | 目标 | 实测 |
| --- | --- | --- |
| 首屏 JS | ≤ 150KB gzip | 110KB |
| 阅读列 | 680px / 17px / 1.8 | 已落地（`reading-width` 笔记有推导） |
| 键盘可达 | 导航 / 主题 / ⌘K / 目录 | 全部可达，⌘K 面板有 Tab 循环与焦点归还 |
| `tsc` / `eslint` | 0 | 0 |
| 每篇有 `updated` / `status` | 必须 | 8 篇全部具备 |
| 375px 无横向滚动 | 必须 | 表格与代码块各自横向滚动，页面不滚 |

## 13. 从「应用」到「站」：预渲染（2026-10-27 晚）

第一轮做完，站点在视觉和内容上已经成立，但有一个结构性缺陷：**它是纯客户端渲染的应用，不是站。**

```
dist 里只有一个 index.html
请求 /notes/reactbits-audit → HTML 里搜不到文章标题（0 次命中）
```

后果是连锁的：搜索引擎拿到空 `<div id="root">`；分享到微信/社交平台只有一行标题；全站共用一个 `<title>`；没有 RSS；首屏必须等 JS 下载执行完才有内容。

对一个以「被检索、被引用、被长期访问」为价值的外脑来说，这等于核心功能没做。

### 做了什么

| 能力 | 实现 |
| --- | --- |
| 每路由静态 HTML | `prerender/entry.tsx` + `scripts/prerender.mjs`，13 个页面 + `404.html` |
| 页面级标题与摘要 | `src/lib/meta.ts` 的 `resolveMeta(pathname)`，客户端与构建期共用 |
| 结构化数据 | 文章输出 `BlogPosting` JSON-LD，站点输出 `WebSite` |
| 派生文件 | `sitemap.xml` / `rss.xml` / `robots.txt`，都由同一份内容索引生成 |
| 缓存策略 | `public/_headers`：带 hash 的资源 immutable，HTML 每次回源 |
| 部署 | `dist/` 纯静态；`.env.example` 提供 `VITE_SITE_URL` |

### 三个踩坑，都写进了代码注释

**坑一：流式 SSR 会让预渲染失效**

`renderToPipeableStream` 和 `prerenderToNodeStream` 遇到 Suspense 边界 pending 时，输出的是

```html
<template id="B:0"></template><div aria-busy="true"></div>
...
<div hidden id="S:0">正文</div>
<script>$RC("B:0","S:0")</script>
```

浏览器执行脚本后正常，爬虫只看到骨架。**同一个组件树，流式 API 在 7 个页面里 5 个分块，`renderToString` 全部 0 分块。**

**坑二：`Outlet` + Suspense + lazy 会触发 pending**

即使页面本身不 suspend，只要渲染路径上有 `React.lazy`，`<Suspense><Outlet/></Suspense>` 就可能把整页塞进 hidden 块。所以 `vite.config.ts` 在 `--mode ssr` 时把 `@/pages`、`@/lib/bodies` alias 到同步版本，`App.tsx` 保持一份。

顺带否掉一个写法：原先想用 Vite 的 `isSsrBuild` 判断，但这个参数在不同版本里名字不稳定，判断失败时构建**照样成功**、只是产物退化成分块 SSR。改用显式 `--mode ssr`，判断依据自己可控。

**坑三：模块作用域的 `new Date()` 会造成 hydration mismatch**

`Footer` 的「构建于」、`Home` 的「本月新增」、`Notes` 的「最近更新 N 天前」原先都在模块作用域读时间。预渲染时算一次，浏览器加载 JS 时又算一次 —— 两边数值不同，React 报 mismatch 并丢弃那段 DOM 重渲染。改成 `define` 注入的 `__BUILD_DATE__` / `__BUILD_TIME__` 常量。

### 刻意加的失败拦截

预渲染最容易出的问题不是崩溃，而是**安静地产出看起来有、其实没有内容的页面**。`scripts/prerender.mjs` 里有三道检查，任何一道不过就让构建失败：

1. 出现 `<template id="B:` 或 `<div hidden id="S:` → 有懒加载没解析；
2. 出现 `aria-busy="true"` → 主体还是骨架；
3. 正文少于 200 字符 → 疑似空页。

### 验收

| 项 | 结果 |
| --- | --- |
| 静态页面数 | 13 + `404.html` |
| 文章页正文（服务端可见） | 1298–2851 字符 |
| 每页 `<title>` 唯一 | 是（`/notes/xxx` 是文章名，不是站点名） |
| 目录路由 | `/notes/xxx` → 301 → `/notes/xxx/`，canonical 指向最终地址 |
| `tsc` / `eslint` / `build` / `smoke` | 0 / 0 / 0 / ALL RENDER |

## 14. 部署：GitHub Pages（2026-10-28）

选它的理由很实际：已有 GitHub 账号、零成本、和仓库天然绑定，不需要额外的平台账号。

### 子路径是这类部署最大的坑

GitHub Pages 的项目站点在 `https://用户名.github.io/仓库名/`，所有绝对路径都少一段前缀。要同时处理四层：

| 层 | 位置 | 处理方式 |
| --- | --- | --- |
| 构建资源 | `vite.config.ts` 的 `base` | 由 `VITE_BASE` 注入，缺省 `/` |
| 路由 | `BrowserRouter` 的 `basename` | 从 `import.meta.env.BASE_URL` 推导 |
| 预渲染 | `StaticRouter` 的 `basename` | 与客户端用同一个值 |
| 原生链接 | `<a href>`、favicon | 手写前缀 / `%BASE_URL%` 占位符 |

第四层最容易漏：`<Link>` 走路由会自动带 basename，而 `<a href="/rss.xml">` 不会。

### 一个会让预渲染白做的陷阱

资源路径全对，也不代表没问题。如果预渲染的 `StaticRouter` 不带 basename，
`<Link to="/notes">` 在服务端生成 `/notes`、在浏览器生成 `/仓库名/notes`。
属性对不上，React 在 hydration 时丢掉那段 DOM 重新渲染 —— **预渲染的收益被完全抹平**。
所以两边必须共用同一个 basename，这一条比资源路径更隐蔽。

### 不硬编码仓库名

workflow 用 `actions/configure-pages` 的输出注入 `VITE_SITE_URL` 与 `VITE_BASE`。
仓库改名、以后换绑自定义域名，都不用改代码。

### 踩坑记录

`VITE_BASE=/demo-app npm run build` 在 Git Bash 里会变成 `/D:/.../demo-app` ——
MSYS 把以 `/` 开头的值当 POSIX 路径做了转换。写进 `.env.local` 更稳。
CI 跑在 Linux 上没有这个问题，所以这个坑只在本地验证时出现。

### 验证方式

`vite preview` 验证不了子路径：它只做 SPA fallback，任何路径都返回 `dist/index.html`，
看起来"每页都对"。要用标准静态服务器模拟目录结构：

```text
tmp/demo-app/          ← python -m http.server 的根
  index.html
  notes/reactbits-audit/index.html
```

实测结果：13 个页面全部 200；`/demo-app/notes/xxx` 301 到带尾斜杠的地址；
JS/CSS 资源 200；`rss.xml` / `sitemap.xml` 里的绝对地址都带子路径。

## 14. 从「纯外脑」到「也能装你的东西」（2026-10-29）

### 起因

两句话：一张脸看久了嫌单调；以及「我希望整个网站并不是单单是学习外脑，
我可以将本地文档或者 markdown 文件上传至网站」。

### 14.1 色彩：从单色到分工制

问题不在"颜色少"，在于**颜色没有承担任何信息**。旧配色里 indigo 只出现在按钮上，
所以除首页极光外，每个页面看起来都是同一张灰底稿。

现在按职责分配，组件不得自由发挥：

| 层 | 变量 | 出现位置 | 纪律 |
| --- | --- | --- | --- |
| 身份/动作 | `--brand` → `--brand-2` | 主按钮、logo、导航当前项下划线、页脚与区块分隔线 | 渐变只在这几处，不铺到正文 |
| 内容分类 | `--topic-engineering/design/tooling` | 主题筛选点、行尾主题名、复盘卡角标 | **只做标签级**，不做大面积色块 |
| 状态语义 | `--decision` / `--warn` / `--evergreen` | 成熟度圆点、错误提示 | 语义固定，不许换色 |
| 环境 | `.page-wash` | 每页顶部 | 越往下越淡，正文区必须回到中性 |

实现上的两个坑，都写进了注释：

1. **`z-index: -1` 会被 body 的背景盖住。** 负层排在"祖先背景之上、body 背景之下"，
   所以 `body` 一旦自己带 `background`，环境色就整块消失 —— 截图里的表现是"改了跟没改一样"。
   解法是把背景画在 `html` 上。这个坑排查了三轮才定位。
2. **`mask-image` 与 `-webkit-mask-image` 要都写。** 只写一个，在旧版 Chromium 上
   渐隐失效，色带会在页面中间出现一条硬边。

### 14.2 导入：本地 markdown 进同一个库

`/import` → IndexedDB（`exoself` / `docs`）→ `/notes` 合并列表 → `/local/:id` 阅读。
没有后端、没有账号、没有上传接口：文件读进内存、存进浏览器、到此为止。

- **运行时渲染器**：`src/lib/markdown.ts`，手写，不装 marked。策略是
  **先转义、再拼自己的标签**，原文里的 HTML 一律成文字，所以不需要 sanitizer，
  也不存在"漏一处就有 XSS"的问题。代价是不支持内嵌 HTML —— 对个人笔记是优点。
- **frontmatter 可选**：没有也能导入，标题取首个 `#` 或文件名，摘要取首段，
  主题归「工程」，成熟度归「萌芽」。
- **同文件重复导入覆盖而非堆叠**：id 由「文件名 + 正文长度 + 前 400 字」哈希得出。
- **接入范围**：`/notes` 列表（带「本地」标记、参与主题/成熟度/标签筛选）、
  ⌘K 面板的「本地」分组、`/local/:id` 阅读页（目录、进度条、导出、删除）。
- **hydration 纪律**：`useLocalDocs` 的初始值恒为 `[]`，读完 IndexedDB 再 `set`。
  服务端读不到 IndexedDB，任何"首次渲染就带上本地文档"的写法都会让 React 丢掉整段 DOM。
- **面板是常驻挂载的**：在 `/import` 导入完再按 ⌘K，组件不会重挂，
  所以 `open` 变化时重读一次库（`reload`），否则新文档永远搜不到 —— 这个 bug 实测出来了。

### 14.3 体积

| 产物 | raw | gzip |
| --- | --- | --- |
| 入口 `index` | 348.9 KB | 112.6 KB |
| `markdown`（Notes / LocalDoc 共享） | 4.6 KB | 1.8 KB |
| `Import` | 9.4 KB | 3.7 KB |
| `LocalDoc` | 5.4 KB | 2.2 KB |

入口比上一版多 2.6 KB gzip（面板新增两个图标 + 环境色组件），渲染器与导入页
全部按路由分包，首屏不背。

### 14.4 验收

`tsc` 0 错 · `eslint` 干净 · 构建 15 页 + 404 · `smoke` ALL RENDER。
CDP 端到端实跑：塞文件 → 落库 1 条 → `/notes` 变 7 篇且置顶带「本地」→
`/local/:id` 渲染出 h2/表格/围栏代码/引用/嵌套列表且 `script` 数为 0 →
⌘K 搜「第二次」命中「本地」组 → 删除后回到空态。1440 / 390、深浅两套主题均实拍。
