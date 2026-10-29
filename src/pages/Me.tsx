import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Layers, Mail, PenLine, User } from 'lucide-react'
import badgePortrait from '@/assets/badge-portrait.webp'
import rooftopSunset from '@/assets/rooftop-sunset.webp'
import sunsetSky from '@/assets/sunset-sky.webp'
import { AuroraBackdrop } from '@/components/effects/AuroraBackdrop'
import DecayCard from '@/components/effects/DecayCard'
import DecryptedText from '@/components/effects/DecryptedText'
import Dock, { type DockItemData } from '@/components/effects/Dock'
import GlowBorder from '@/components/effects/GlowBorder'
import LanyardBadge from '@/components/effects/LanyardBadge'
import MagneticButton from '@/components/effects/MagneticButton'
import ScrollExpand from '@/components/effects/ScrollExpand'
import TiltCard from '@/components/effects/TiltCard'
import { NoteRow } from '@/components/notes/NoteRow'
import { PageWash } from '@/components/common/PageWash'
import { Button } from '@/components/ui/Button'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatDate, notes, retros } from '@/lib/content'
import { SITE } from '@/lib/site'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import './Me.css'

const BASE = import.meta.env.BASE_URL

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
  /*
   * 收尾那张人像卡按断点挂载：它下面没有别的内容，晚一步出现没人看得见，
   * 而窄屏上省掉的是 38KB。首屏的工牌不这么办 —— 它在折叠线以上，
   * 预渲染产物里就得有，否则桌面首帧会空出右边那一栏。
   * 断点值另外给段间那张图用：桌面竖构图起手、手机横幅起手（见下面 ScrollExpand）。
   */
  const isWide = useMediaQuery('(min-width: 1024px)')

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
      <PageWash tone="me" />
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

        {/*
          工牌挂在首屏：身份这件事，做成能抓的东西比写一行「你好，我是…」有用。
          窄屏排在正文之后，xl 起挪到右侧空出来的那一列。
        */}
        <div className="me-lanyard">
          <LanyardBadge
            handle={SITE.github.split('/').pop() ?? 'ME'}
            role="前端 · TypeScript · 构建管线"
            photo={badgePortrait}
          />
        </div>

        {/*
          滚动提示抬到 Dock 之上：Dock 现在常驻底部，原来 24px 的位置会被它盖住。
          留出的高度按 Dock 的厚度（68px）加底边距算，正好卡在面板上沿外面。
        */}
        <div className="me-hint absolute inset-x-0 bottom-24 flex justify-center">
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
        {/*
          起手框的形状得跟「视口方向」匹配，不然切出来的是条横穿的切片：
          桌面 1440×900 下，66×46 得到 950×414 的窗（2.3:1），正从人物腰部横切过去，
          左边还空出三成栏杆。而这张图的人物在画面 63% 处，cover 在这个尺寸下横向只能挪
          238px，不缩放根本挪不到中间 —— 所以桌面改成 48×68 的竖构图 + mediaZoom 1.25：
          图上多出来的那圈余量让画面能横移，人物才被框正。
          手机是竖屏，横幅起手本来就不合适，保持 66×46 + zoom 1，取景偏置交给 Me.css。
        */}
        <ScrollExpand
          useWindowScroll
          src={rooftopSunset}
          alt="黄昏的天台：一位短发角色坐在折叠椅上，身后是亮着红光的自动售货机、栏杆和城市天际线"
          scrollHint="继续滚动"
          startWidth={isWide ? 48 : 66}
          startHeight={isWide ? 68 : 46}
          mediaZoom={isWide ? 1.25 : 1}
          startRadius={20}
          scrollDistance={1.1}
          holdDistance={0.2}
          smoothing={0.08}
        >
          {/* 不传 title：它和 children 都是 inset-0 居中，同时给会叠在一起 */}
          {/* 字压在照片上：照片比原来的示意图亮也更碎，靠 text-shadow 兜住对比度，不改图本身 */}
          <div className="max-w-[34rem] [text-shadow:0_2px_20px_rgba(0,0,0,0.6)]">
            <p className="text-[clamp(1.6rem,3.6vw,2.6rem)] leading-[1.2] font-medium tracking-[-0.02em] text-white">
              细节不是加出来的，
              <br />
              是砍剩下的。
            </p>
            <p className="mx-auto mt-5 max-w-[42ch] text-[14px] leading-relaxed text-white/80">
              这一页用了九个效果，任意一屏都不会同时跑两个。删掉的比留下的多，界面才开始有形状。
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
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16">
            <div>
              <p className="font-mono text-label tracking-[0.14em] text-faint">CONTACT</p>
              <h2 className="mt-3 max-w-[18em] text-h2 leading-[1.25] font-medium tracking-[-0.011em] text-fg">
                想聊，或者只是想看看我在写什么。
              </h2>
              <p className="mt-4 max-w-[48ch] text-meta leading-relaxed text-muted">
                这个站没有评论框，也没有表单。找我最直接的方式是 GitHub。
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-4">
                <MagneticButton
                  onClick={() => window.open(SITE.github, '_blank', 'noopener,noreferrer')}
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

            {/*
              收尾这张图直接复刻 reactbits 的 DecayCard：指针动得越快撕得越开，
              停下 0.6s 自己合回去，没人碰时边缘也一直在轻轻起毛。
              参数全用原版默认值（scope=window），只改了尺寸和圆角去对齐站里的卡 ——
              上一版把它调成 0.22 的强度、几乎不动，那不是这个效果。
              lg 以下不挂载：触屏没有「指针速度」这个输入，撕裂就退化成一张普通照片。
            */}
            <div className="me-cover-card hidden lg:block">
              {isWide ? (
                <div role="img" aria-label="傍晚的火烧云：橙金与靛蓝交错的鱼鳞天，画面底部压着一排树梢与吊臂的剪影">
                  <DecayCard image={sunsetSky} width={300} height={400} radius={12} />
                </div>
              ) : null}
              <p className="me-cover-card__hint">把指针放上去</p>
            </div>
          </div>
        </div>
      </section>

      {/*
        Dock 常驻在视口底部，不随滚动出现或退场：它的隐喻就是「贴着屏幕边缘」，
        一有显隐条件，它就从导航退化成装饰。
      */}
      <div className="me-dock">
        <Dock
          items={dockItems}
          position="bottom"
          theme={theme}
          baseItemSize={38}
          magnification={58}
          gap={6}
          roundness={1}
          showLabels
        />
      </div>
    </div>
  )
}
