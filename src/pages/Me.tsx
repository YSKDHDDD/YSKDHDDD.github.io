import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Layers, Mail, PenLine, User } from 'lucide-react'
import { AuroraBackdrop } from '@/components/effects/AuroraBackdrop'
import DecryptedText from '@/components/effects/DecryptedText'
import Dock, { type DockItemData } from '@/components/effects/Dock'
import GlowBorder from '@/components/effects/GlowBorder'
import MagneticButton from '@/components/effects/MagneticButton'
import ScrollExpand from '@/components/effects/ScrollExpand'
import TiltCard from '@/components/effects/TiltCard'
import { NoteRow } from '@/components/notes/NoteRow'
import { Button } from '@/components/ui/Button'
import { formatDate, notes, retros } from '@/lib/content'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import './Me.css'

const BASE = import.meta.env.BASE_URL
const GITHUB = 'https://github.com/YSKDHDDD'

/**
 * 三件不让步的事。
 *
 * 每条都挂着一篇笔记当证据 —— 说「在意可维护性」，就链到对应的复盘，
 * 否则等于没说。这也是这一页的写法：不介绍效果，只介绍我怎么工作。
 */
const principles = [
  {
    tag: 'ENGINEERING',
    title: '类型是用来检查的，不是用来展示的',
    body: 'tsc 退出码是 0，才配说「能维护」。类型写完却没人跑，等于没写。',
    href: '/notes/reactbits-audit',
    evidence: '从 13 个类型错误里读出的结构问题',
  },
  {
    tag: 'BUILD',
    title: '能在构建期算完的，不留给浏览器',
    body: '目录、阅读时长、标题锚点都由编译器产出。首屏只负责渲染，不负责计算。',
    href: '/notes/mdx-build-time',
    evidence: '把内容分析搬到构建期',
  },
  {
    tag: 'INTERFACE',
    title: '克制是设计的一部分',
    body: '一屏只留一个常驻动效，阅读页一个不留。审美更多体现在删掉什么。',
    href: '/notes/effect-budget',
    evidence: '给动效做预算',
  },
]

/**
 * 重效果（WebGL）只在容器接近视口时挂载，离开后延迟卸载。
 *
 * 首屏那片极光是整个着色器管线，挂在页面底部毫无意义；滚出首屏就该把它卸掉，
 * 否则一次访问要为一个看不见的 canvas 付全程的帧预算。
 * 延迟窗口是为了容忍来回小幅滚动 —— 判定一抖动就重建 WebGL 上下文，
 * 恢复成本远高于省下的那点开销。
 *
 * 判据写成显式的矩形比较而不是 IntersectionObserver：整页只有一个容器要判定，
 * 一次 getBoundingClientRect 就够，而且「视口上下各留 margin」这句话能直接被读出来，
 * 不用再去记 rootMargin 的语义。
 */
function useNearViewport<T extends HTMLElement>(margin = 240, unmountDelay = 1600) {
  const ref = useRef<T>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let timer = 0

    const check = () => {
      const el = ref.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const near = rect.top < window.innerHeight + margin && rect.bottom > -margin

      window.clearTimeout(timer)
      if (near) setMounted(true)
      else timer = window.setTimeout(() => setMounted(false), unmountDelay)
    }

    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [margin, unmountDelay])

  return [ref, mounted] as const
}

const sectionLinks = [
  { id: 'top', label: '开头', icon: <User size={18} aria-hidden /> },
  { id: 'work', label: '在意的', icon: <Layers size={18} aria-hidden /> },
  { id: 'writing', label: '写的', icon: <PenLine size={18} aria-hidden /> },
  { id: 'contact', label: '联系', icon: <Mail size={18} aria-hidden /> },
]

export default function Me() {
  const { theme } = useTheme()
  const [heroRef, heroMounted] = useNearViewport<HTMLElement>(0, 0)
  const [dockOn, setDockOn] = useState(false)

  /**
   * Dock 是这一页的段落导航，不是常驻装饰：进正文才浮出来，快到底就退场，
   * 免得压住结尾区。阈值用首屏高度算，换视口大小不用重记数字。
   */
  useEffect(() => {
    const onScroll = () => {
      const heroHeight = heroRef.current?.offsetHeight ?? window.innerHeight
      const doc = document.documentElement
      const nearEnd = window.scrollY + window.innerHeight > doc.scrollHeight - 620
      setDockOn(window.scrollY > heroHeight * 0.72 && !nearEnd)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [heroRef])

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  const dockItems: DockItemData[] = sectionLinks.map((item) => ({
    label: item.label,
    icon: item.icon,
    onClick: () => jump(item.id),
  }))

  const featured = notes[0]
  const rest = notes.slice(1, 4)

  return (
    <div className="me">
      {/* ---------- 首屏：极光在标题背后，不在一个框里 ---------- */}
      <section
        id="top"
        ref={heroRef}
        className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden pt-14 pb-20"
      >
        {/*
          静态渐变垫在极光下面：WebGL 初始化失败或显卡被禁用的机器上，
          AuroraBackdrop 会整体空白。垫一层 CSS 渐变，最差也是一片有方向的光，
          而不是一块纯黑。极光跑起来时会盖住它，两者色相是同一套。
        */}
        <div aria-hidden className="me-hero__glow" />
        {heroMounted ? <AuroraBackdrop /> : null}

        <div className="page-shell relative">
          <p className="font-mono text-label tracking-[0.14em] text-faint">ME · 个人主页</p>

          <h1 className="mt-6 max-w-[15em] text-h1 leading-[1.15] font-medium tracking-[-0.03em] text-fg sm:text-display">
            写能读懂的代码，
            <br />
            做<span className="text-brand"><DecryptedText text="摸得到" animateOn="view" speed={45} maxIterations={18} revealDirection="center" /></span>的界面。
          </h1>

          {/* 中文句子不在 JSX 里断行：换行会被折叠成一个空格，中文里就是多出来的空隙 */}
          <p className="mt-7 max-w-[46ch] text-body leading-relaxed text-muted">
            前端。写 TypeScript，也写构建管线。在意两件事：代码读起来顺不顺，界面跟不跟手。
          </p>

          <p className="mt-3 max-w-[46ch] text-meta leading-relaxed text-faint">
            这个站是我的学习外脑 —— 读过的、踩过的、想明白的，都沉淀成能检索的文字。
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/notes">
              <Button variant="primary" size="md">
                读笔记
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="outline" size="md">
                完整履历
              </Button>
            </Link>
          </div>

          <p className="mt-10 font-mono text-label text-faint">
            {notes.length} 篇笔记 · {retros.length} 个复盘 · 最近更新{' '}
            {formatDate(featured.meta.updated)}
          </p>
        </div>

        <div className="me-hint absolute inset-x-0 bottom-6 flex justify-center">
          <ArrowDown className="me-hint__icon h-4 w-4 text-faint" aria-hidden />
        </div>
      </section>

      {/* ---------- 在意的事：三张可以翻的卡 ---------- */}
      <section id="work" className="page-shell scroll-mt-20 py-20 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="font-mono text-label tracking-[0.14em] text-faint">HOW I WORK</p>
            <h2 className="mt-3 max-w-[20em] text-h2 leading-[1.25] font-medium tracking-[-0.011em] text-fg">
              三件我不愿让步的事
            </h2>
          </div>
          <p className="max-w-[32ch] text-label leading-relaxed text-faint">
            每条都挂着一篇笔记当证据。说得出，也查得到。
          </p>
        </div>

        <div className="mt-10 grid gap-4 [perspective:1200px] md:grid-cols-3">
          {principles.map((item) => (
            <TiltCard key={item.title} className="h-full rounded-md">
              <Link
                to={item.href}
                className={cn(
                  'group flex h-full flex-col rounded-md border border-line bg-surface/40 p-5',
                  'transition-colors duration-[var(--motion-fast)] hover:border-line-strong',
                )}
              >
                <span className="font-mono text-label tracking-[0.12em] text-faint">{item.tag}</span>
                <h3 className="mt-4 text-body leading-relaxed font-medium text-fg">{item.title}</h3>
                <p className="mt-2.5 text-meta leading-relaxed text-muted">{item.body}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-6 text-label text-faint transition-colors group-hover:text-brand">
                  {item.evidence}
                  <ArrowUpRight
                    className="h-3 w-3 transition-transform duration-[var(--motion-fast)] group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ---------- 最近写的：光只给一篇，用来指路 ---------- */}
      <section id="writing" className="page-shell scroll-mt-20 pb-20 sm:pb-24">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="font-mono text-label tracking-[0.14em] text-faint">WRITING</p>
            <h2 className="mt-3 text-h2 leading-[1.25] font-medium tracking-[-0.011em] text-fg">
              最近写的
            </h2>
          </div>
          <Link
            to="/notes"
            className="group inline-flex items-center gap-1 text-meta text-muted transition-colors hover:text-fg"
          >
            全部笔记
            <ArrowRight
              className="h-3 w-3 transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

        <GlowBorder className="mt-8">
          <Link to={`/notes/${featured.slug}`} className="group block p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-label text-faint">
              <span className="text-brand">最新</span>
              <time dateTime={featured.meta.date} className="tabular-nums">
                {formatDate(featured.meta.date)}
              </time>
              <span aria-hidden>·</span>
              <span>{featured.readingTime} 分钟</span>
            </div>

            <h3 className="mt-4 max-w-[24em] text-h3 leading-snug font-medium tracking-[-0.01em] text-fg transition-colors group-hover:text-brand">
              {featured.meta.title}
            </h3>
            <p className="mt-3 max-w-[56ch] text-meta leading-relaxed text-muted">
              {featured.meta.summary}
            </p>
          </Link>
        </GlowBorder>

        <div className="mt-6">
          {rest.map((note) => (
            <NoteRow key={note.slug} note={note} />
          ))}
        </div>
      </section>

      {/* ---------- 段间：一句立场，用整屏展开的图说 ---------- */}
      <section aria-label="我的看法">
        <ScrollExpand
          useWindowScroll
          src={`${BASE}me-cover.svg`}
          alt="一张抽象的界面剖面：深色底上的极光、栅格与十字准线"
          scrollHint="继续滚动"
          startWidth={40}
          startHeight={58}
          startRadius={20}
          scrollDistance={1.1}
          holdDistance={0.2}
          smoothing={0.08}
        >
          {/* 不传 title：它和 children 都是 inset-0 居中，同时给会叠在一起 */}
          <div className="max-w-[30ch]">
            <p className="text-[clamp(1.6rem,3.6vw,2.6rem)] leading-[1.2] font-medium tracking-[-0.02em] text-white">
              细节不是加出来的，
              <br />
              是砍剩下的。
            </p>
            <p className="mt-5 text-[14px] leading-relaxed text-white/70">
              这一页用了七个效果，任意一屏都不会同时跑两个。删掉的比留下的多，界面才开始有形状。
            </p>
          </div>
        </ScrollExpand>
      </section>

      {/* ---------- 联系：一个磁吸按钮收尾 ---------- */}
      <section id="contact" className="relative isolate overflow-hidden">
        {/*
          收尾的辉光是一层静态径向渐变，不是效果组件。
          GradientWaves 的波形自带一条硬起线，压到 140px 就成了一条彩色横杠 ——
          它适合整页背景，不适合当分隔。这里宁可少一个效果，也不让一个效果显得廉价。
        */}
        <div aria-hidden className="me-endglow" />

        <div className="page-shell relative py-24 sm:py-28">
          <p className="font-mono text-label tracking-[0.14em] text-faint">CONTACT</p>
          <h2 className="mt-3 max-w-[18em] text-h2 leading-[1.25] font-medium tracking-[-0.011em] text-fg">
            想聊，或者只是想看看我在写什么。
          </h2>
          <p className="mt-4 max-w-[48ch] text-meta leading-relaxed text-muted">
            这个站没有评论框，也没有表单。找我最直接的方式是 GitHub。
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-4">
            <MagneticButton
              onClick={() => window.open(GITHUB, '_blank', 'noopener,noreferrer')}
            >
              在 GitHub 上找我
            </MagneticButton>

            <a
              href={`${BASE}rss.xml`}
              className="text-meta text-muted transition-colors hover:text-fg"
            >
              订阅 RSS
            </a>
            <Link to="/craft" className="text-meta text-muted transition-colors hover:text-fg">
              看效果的技术说明
            </Link>
          </div>
        </div>
      </section>

      {/* Dock：只在这一页出现，只干段落导航这一件事 */}
      <div className={cn('me-dock', dockOn && 'is-on')}>
        <Dock
          items={dockItems}
          position="bottom"
          theme={theme}
          baseItemSize={38}
          magnification={58}
          gap={6}
          roundness={1}
          showLabels={false}
        />
      </div>
    </div>
  )
}
