import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { AuroraBackdrop } from '@/components/effects/AuroraBackdrop'
import DecryptedText from '@/components/effects/DecryptedText'
import { Reveal } from '@/components/effects/Reveal'
import { SectionHeading } from '@/components/common/SectionHeading'
import { NoteRow } from '@/components/notes/NoteRow'
import { RetroCard } from '@/components/notes/RetroCard'
import { Button } from '@/components/ui/Button'
import { formatDate, notes, nowItems, retros } from '@/lib/content'

// 构建期常量（vite define 注入）：判断「本月新增」不能跟着用户访问时间漂移
const monthPrefix = __BUILD_DATE__.slice(0, 7)

const craftTiles = [
  { name: 'SoftAurora', tech: 'WebGL 片元着色器', hint: '首屏背景，空闲后加载', href: '/craft#soft-aurora' },
  { name: 'DecryptedText', tech: '逐字测量 + Canvas 度量', hint: '只解一个词，不整句闪', href: '/craft#decrypted-text' },
  { name: 'ScrollExpand', tech: '滚动进度映射 transform', hint: '默认静帧，交互后才跑', href: '/craft#scroll-expand' },
  { name: 'Dock', tech: '指针距离驱动的弹性放大', hint: '从导航降级为展品', href: '/craft#dock' },
]

export default function Home() {
  const latest = notes[0]
  const thisMonth = notes.filter((note) => note.meta.date.startsWith(monthPrefix)).length

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <AuroraBackdrop />

        <div className="page-shell relative pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="grid gap-12 lg:grid-cols-[1.5fr_0.7fr] lg:items-end">
            <div>
              <p className="font-mono text-label tracking-[0.14em] text-faint">
                学习外脑 · LEARNING EXOSELF
              </p>

              <h1 className="mt-6 max-w-[15em] text-h1 font-medium tracking-[-0.025em] text-fg sm:text-display">
                技术笔记与项目复盘，
                <br />
                <span className="text-brand">
                  <DecryptedText
                    text="沉淀"
                    animateOn="view"
                    loop
                    loopDelay={7000}
                    speed={55}
                    maxIterations={14}
                  />
                </span>
                成一个可检索的外脑
              </h1>

              <p className="mt-6 max-w-[46ch] text-body text-muted">
                关注代码可读性与可维护性，也用界面细节证明工程审美。
                内容以 MDX 维护，索引在构建期生成，正文按篇加载。
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/notes">
                  <Button variant="primary" size="md">
                    浏览笔记
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </Link>
                <Link to="/retro">
                  <Button variant="outline" size="md">
                    读一篇复盘
                  </Button>
                </Link>
              </div>
            </div>

            {/* 活的细节：数据都是真的，才叫细节 */}
            <Reveal as="aside" className="rounded-md border border-line bg-surface/40 p-4 backdrop-blur-sm">
              <p className="text-label tracking-[0.08em] text-faint">现在</p>
              <dl className="mt-3 space-y-2.5 font-mono text-label">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-faint">最近更新</dt>
                  <dd className="text-fg">{formatDate(latest.meta.updated)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-faint">本月新增</dt>
                  <dd className="text-fg">{thisMonth} 篇</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-faint">累计</dt>
                  <dd className="text-fg">
                    {notes.length} 笔记 / {retros.length} 复盘
                  </dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-line pt-3 text-label leading-relaxed text-faint">
                {latest.meta.title}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <div className="page-shell space-y-24 pb-8">
        {/* 01 现在 */}
        <section aria-label="现在">
          <Reveal>
            <SectionHeading index="01" title="现在" hint="站点还活着，不是三年前的静态作品集" />
          </Reveal>

          <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
            {nowItems.map((item, index) => (
              <Reveal key={item.label} delay={index * 60} className="bg-bg p-5">
                <p className="text-label tracking-[0.08em] text-faint">{item.label}</p>
                <h3 className="mt-3 text-body font-medium text-fg">{item.title}</h3>
                <p className="mt-2 text-meta leading-relaxed text-muted">{item.detail}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 02 最近笔记 */}
        <section aria-label="最近笔记">
          <Reveal>
            <SectionHeading
              index="02"
              title="最近笔记"
              hint={`共 ${notes.length} 篇 · 按更新时间倒序`}
              action={
                <Link
                  to="/notes"
                  className="group inline-flex items-center gap-1 text-muted transition-colors hover:text-fg"
                >
                  全部笔记
                  <ArrowRight className="h-3 w-3 transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5" aria-hidden />
                </Link>
              }
            />
          </Reveal>

          <div className="mt-2">
            {notes.slice(0, 5).map((note, index) => (
              <Reveal key={note.slug} delay={index * 40}>
                <NoteRow note={note} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* 03 精选复盘 */}
        <section aria-label="精选复盘">
          <Reveal>
            <SectionHeading
              index="03"
              title="精选复盘"
              hint="每个复盘都按「问题 → 决策 → 结果」组织"
              action={
                <Link
                  to="/retro"
                  className="group inline-flex items-center gap-1 text-muted transition-colors hover:text-fg"
                >
                  全部复盘
                  <ArrowRight className="h-3 w-3 transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5" aria-hidden />
                </Link>
              }
            />
          </Reveal>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {retros.map((retro, index) => (
              <Reveal key={retro.slug} delay={index * 60}>
                <RetroCard retro={retro} className="h-full" />
              </Reveal>
            ))}
          </div>
        </section>

        {/* 04 工艺 */}
        <section aria-label="工艺">
          <Reveal>
            <SectionHeading
              index="04"
              title="工艺"
              hint="八个效果，一份滚动叙事；每个都标注了用了什么、为什么留"
              action={
                <div className="flex items-center gap-4">
                  <Link
                    to="/me"
                    className="group inline-flex items-center gap-1 text-fg transition-colors hover:text-brand"
                  >
                    滚动叙事
                    <ArrowRight
                      className="h-3 w-3 transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                  <Link
                    to="/craft"
                    className="text-muted transition-colors hover:text-fg"
                  >
                    技术说明
                  </Link>
                </div>
              }
            />
          </Reveal>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {craftTiles.map((tile, index) => (
              <Reveal key={tile.name} delay={index * 50}>
                <Link
                  to={tile.href}
                  className="group block rounded-md border border-line bg-surface/40 p-4 transition-colors duration-[var(--motion-fast)] hover:border-line-strong"
                >
                  <div className="mb-4 flex h-16 items-end gap-1 overflow-hidden" aria-hidden>
                    {[0.3, 0.55, 0.4, 0.8, 0.6, 0.35, 0.5].map((height, barIndex) => (
                      <span
                        key={barIndex}
                        className="w-full rounded-sm bg-line-strong transition-colors duration-[var(--motion-fast)] group-hover:bg-brand/45"
                        style={{ height: `${height * 100}%` }}
                      />
                    ))}
                  </div>
                  <h3 className="font-mono text-meta text-fg">{tile.name}</h3>
                  <p className="mt-1 text-label text-faint">{tile.tech}</p>
                  <p className="mt-2 text-label leading-relaxed text-muted">{tile.hint}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
