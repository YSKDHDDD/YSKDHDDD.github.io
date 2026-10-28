import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { SITE } from '@/lib/site'

const strengths = [
  {
    title: 'TypeScript 与工程约束',
    claim: '把「可维护」翻译成能检查的东西：类型、lint、构建产物。',
    evidence: [
      { label: '从 13 个类型错误里读出的结构问题', href: '/notes/reactbits-audit' },
      { label: '重构一个「看起来能跑」的演示站', href: '/retro/demo-app-rebuild' },
    ],
  },
  {
    title: '构建期思维',
    claim: '能在构建期算完的，不留给浏览器。索引、TOC、阅读时长都是产物的一部分。',
    evidence: [
      { label: '把内容分析搬到构建期', href: '/notes/mdx-build-time' },
      { label: 'Tailwind v4 接入', href: '/notes/tailwind-v4-pipeline' },
    ],
  },
  {
    title: '界面与动效克制',
    claim: '审美的判断力体现在拒绝：一个屏只留一个常驻动效，阅读页一个都不留。',
    evidence: [
      { label: '给动效做预算', href: '/notes/effect-budget' },
      { label: '680px 是怎么算出来的', href: '/notes/reading-width' },
    ],
  },
]

export default function About() {
  return (
    <div className="page-shell py-12 sm:py-16">
      <header className="max-w-[52ch]">
        <p className="font-mono text-label tracking-[0.14em] text-faint">ABOUT</p>
        <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">关于</h1>
      </header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_320px]">
        <div className="space-y-12">
          <section aria-label="我在做什么">
            <h2 className="text-label tracking-[0.06em] text-faint">我在做什么</h2>
            <p className="mt-3 max-w-[62ch] text-body text-muted">
              写前端，也写构建工具链。这个站点是我给自己造的学习外脑：
              把读过的、踩过的、想明白的东西沉淀成结构和文字，而不是散在收藏夹里。
            </p>
          </section>

          <section aria-label="我擅长什么">
            <h2 className="text-label tracking-[0.06em] text-faint">我擅长什么</h2>
            <div className="mt-4 space-y-px overflow-hidden rounded-md border border-line bg-line">
              {strengths.map((item) => (
                <div key={item.title} className="bg-bg p-4">
                  <h3 className="text-body font-medium text-fg">{item.title}</h3>
                  <p className="mt-1.5 max-w-[60ch] text-meta text-muted">{item.claim}</p>
                  <ul className="mt-3 space-y-1">
                    {item.evidence.map((evidence) => (
                      <li key={evidence.href}>
                        <Link
                          to={evidence.href}
                          className="group inline-flex items-center gap-1 text-meta text-faint transition-colors hover:text-fg"
                        >
                          {evidence.label}
                          <ArrowUpRight
                            className="h-3 w-3 transition-transform duration-[var(--motion-fast)] group-hover:-translate-y-0.5"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-label text-faint">
              每一项都挂着证据链接。说「熟悉 TypeScript」，就链到对应的复盘 —— 否则等于没说。
            </p>
          </section>

          <section aria-label="怎么联系我">
            <h2 className="text-label tracking-[0.06em] text-faint">怎么联系我</h2>
            <p className="mt-3 max-w-[56ch] text-meta text-muted">
              这个站没有评论框，也没有表单。找我最直接的方式是 GitHub。
            </p>
            <a
              href={SITE.github}
              target="_blank"
              rel="noreferrer noopener"
              className="group mt-4 inline-flex items-center gap-1.5 font-mono text-meta text-fg transition-colors hover:text-brand"
            >
              github.com/YSKDHDDD
              <ArrowUpRight
                className="h-3 w-3 transition-transform duration-[var(--motion-fast)] group-hover:-translate-y-0.5"
                aria-hidden
              />
            </a>
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-md border border-line bg-surface/50 p-4">
            <h2 className="text-label tracking-[0.06em] text-faint">技术栈</h2>
            <ul className="mt-3 space-y-2 font-mono text-label text-muted">
              {[
                ['框架', 'React 19 + react-router v7'],
                ['构建', 'Vite 8 + Rolldown'],
                ['样式', 'Tailwind v4 · 语义令牌'],
                ['内容', 'MDX · 构建期索引'],
                ['高亮', 'shiki 双主题'],
                ['检索', 'fuse.js 本地索引'],
              ].map(([key, value]) => (
                <li key={key} className="flex justify-between gap-3 border-b border-line pb-2">
                  <span className="text-faint">{key}</span>
                  <span className="text-right text-fg">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
