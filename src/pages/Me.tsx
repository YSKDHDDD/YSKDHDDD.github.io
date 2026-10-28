import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, Layers, Pointer, ScanLine, Sparkles } from 'lucide-react'
import DecryptedText from '@/components/effects/DecryptedText'
import Dock, { type DockItemData } from '@/components/effects/Dock'
import GlowBorder from '@/components/effects/GlowBorder'
import GradientWaves from '@/components/effects/GradientWaves'
import MagneticButton from '@/components/effects/MagneticButton'
import ScrollExpand from '@/components/effects/ScrollExpand'
import SoftAurora from '@/components/effects/SoftAurora'
import TiltCard from '@/components/effects/TiltCard'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import './Me.css'

const BASE = import.meta.env.BASE_URL

/**
 * 段落顺序即叙事顺序：观看距离从远到近。
 *
 * 氛围（远）→ 结构（中）→ 文本 → 触感（近）→ 可达 → 细节（特写）。
 * 换顺序就散了：先讲 1.5px 的边框，再讲极光，读者会觉得后半段在退步。
 */
const SECTION_IDS = [
  'soft-aurora',
  'gradient-waves',
  'expand',
  'decrypted-text',
  'tilt-card',
  'magnetic-button',
  'dock',
  'glow-border',
] as const

const dockItems: DockItemData[] = [
  { label: '氛围', icon: <Sparkles size={18} aria-hidden />, onClick: () => undefined },
  { label: '结构', icon: <Layers size={18} aria-hidden />, onClick: () => undefined },
  { label: '触感', icon: <Pointer size={18} aria-hidden />, onClick: () => undefined },
  { label: '细节', icon: <ScanLine size={18} aria-hidden />, onClick: () => undefined },
]

interface StageProps {
  id: string
  index: string
  distance: string
  claim: string
  body: string
  note: string
  active: boolean
  tall?: boolean
  children: ReactNode
}

/**
 * 一段 = 一个效果。
 *
 * 效果只在段落穿过视口中心时才挂载，离开 2 秒后卸载。
 * 八个效果同时活着意味着八个 canvas / WebGL context 一起跑帧，
 * 滚动会直接掉到个位数帧率；延迟 2 秒是为了容忍来回小幅滚动，不做「滚一下就重挂」。
 */
function Stage({ id, index, distance, claim, body, note, active, tall, children }: StageProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    /**
     * 这里的 setState 只在 active 翻转时触发一次，不会级联 ——
     * 规则按调用位置做文本匹配，所以和 SiteNav 的滚动监听一样用函数包一层。
     * 卸载延迟是真正的需求：判定用一条窄带，来回小幅滚动会反复进出，
     * 不留窗口就会把 WebGL 上下文反复建了又丢。
     */
    const mount = () => setMounted(true)
    const unmount = () => setMounted(false)

    if (active) {
      mount()
      return
    }

    const timer = window.setTimeout(unmount, 2000)
    return () => window.clearTimeout(timer)
  }, [active])

  return (
    <section id={id} data-me-stage className="me-stage" aria-labelledby={`${id}-title`}>
      <div className="page-shell">
        <div className="me-stage__grid">
          <div>
            <div className="flex items-baseline gap-4">
              <span className="me-stage__index" aria-hidden>
                {index}
              </span>
              <span className="font-mono text-label tracking-[0.14em] text-faint">{distance}</span>
            </div>

            <h2
              id={`${id}-title`}
              className="mt-6 max-w-[20em] text-h2 leading-[1.25] font-medium tracking-[-0.011em] text-fg"
            >
              {claim}
            </h2>

            <p className="mt-4 max-w-[52ch] text-meta leading-relaxed text-muted">{body}</p>

            <p className="mt-6 max-w-[52ch] border-l border-line pl-3.5 text-label leading-relaxed text-faint">
              {note}
            </p>
          </div>

          <div className={cn('me-demo', tall && 'me-demo--tall')} data-mounted={mounted}>
            {mounted ? children : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Me() {
  const { theme } = useTheme()
  const [activeId, setActiveId] = useState<string>(SECTION_IDS[0])

  /**
   * 判定「当前是哪一段」用一条收窄到视口中间的带子（上下各留 40%）。
   * 用 scroll 事件算距离也行，但八段就八个 getBoundingClientRect，
   * 没必要为了这点精度自己写节流。IntersectionObserver 交给浏览器调度。
   */
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-me-stage]'))
    if (!nodes.length) return

    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        // 取 DOM 顺序里第一个仍在带子里的：快速滚动时可能两段同时命中
        const next = nodes.find((node) => visible.has(node.id))
        if (next) setActiveId(next.id)
      },
      { rootMargin: '-40% 0px -40% 0px' },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const isActive = (id: string) => activeId === id

  return (
    <div>
      <header className="page-shell flex min-h-[calc(100svh-4rem)] flex-col justify-center pt-12 pb-16">
        <p className="font-mono text-label tracking-[0.14em] text-faint">ME · 一条观看路径</p>

        <h1 className="mt-6 max-w-[14em] text-h1 font-medium tracking-[-0.03em] text-fg sm:text-display">
          我看界面，
          <br />
          从远处看起。
        </h1>

        <p className="mt-6 max-w-[46ch] text-body leading-relaxed text-muted">
          八段，从氛围到细节，每段只放一个效果。滚过去，它才动 ——
          同一屏只跑一个，是这一页唯一守着的规矩。
        </p>

        <p className="mt-4 max-w-[46ch] text-meta leading-relaxed text-faint">
          想看每个效果怎么写的，去「工艺」；想要一份正经履历，去「关于」。
          这一页只负责看。
        </p>

        <div className="mt-12 flex items-center gap-2.5 font-mono text-label text-faint">
          <ArrowDown className="me-hint h-3.5 w-3.5" aria-hidden />
          向下滚动
        </div>
      </header>

      <Stage
        id="soft-aurora"
        index="01"
        distance="远 · 氛围"
        claim="第一眼看到的不是内容，是光。"
        body="首屏那片极光是 WebGL 片元着色器画的。它不在首帧挂载，而是等主线程空闲之后再上；滚出首屏就随组件卸载。氛围的作用是让人愿意留下来，不是让人一直盯着看。"
        note="首屏多等 200ms 换一段光，值得；多等两秒，就不值得。这条线画在哪，才是审美。"
        active={isActive('soft-aurora')}
        tall
      >
        <div className="absolute inset-0">
          <SoftAurora className="absolute inset-0" lightMode={theme === 'light'} quality="medium" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-subtle to-transparent" />
        </div>
      </Stage>

      <Stage
        id="gradient-waves"
        index="02"
        distance="远 · 氛围"
        claim="动得慢，才像呼吸。"
        body="两块 2D Canvas 的正弦波叠在一起，速度压到 0.35。全站只用在一处：404 页。一个一年见一次的页面，才配得上一个常驻动效。"
        note="同一个效果放在首页会腻，放在 404 会惊喜 —— 位置决定它是噪音还是礼物。"
        active={isActive('gradient-waves')}
      >
        <div className="absolute inset-0">
          <GradientWaves className="absolute inset-0" height={210} speed={0.35} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-subtle to-transparent" />
        </div>
      </Stage>

      {/* ScrollExpand 自己撑开滚动距离，不套 Stage：它要的是一整段轨道，不是一屏 */}
      <section id="expand" data-me-stage>
        <ScrollExpand
          useWindowScroll
          src={`${BASE}me-cover.svg`}
          alt="一张抽象的界面剖面：深色底上的极光、栅格与十字准线"
          scrollHint="继续滚动"
          startWidth={38}
          startHeight={56}
          startRadius={18}
          scrollDistance={1.1}
          holdDistance={0.2}
          smoothing={0.08}
        >
          {/* 不传 title：它和 children 都是 inset-0 居中，同时给会叠在一起 */}
          <div className="max-w-[30ch]">
            <p className="font-mono text-[11px] tracking-[0.14em] text-white/50">03 · 中 · 结构</p>
            <p className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.15] font-medium tracking-[-0.02em] text-white">
              结构是滚出来的
            </p>
            <p className="mt-5 text-[14px] leading-relaxed text-white/70">
              画面从 38% 展开到满屏，圆角同步收到 0 —— 滚动本身就是进度条。
            </p>
          </div>
        </ScrollExpand>
      </section>

      <Stage
        id="decrypted-text"
        index="04"
        distance="中 · 文本"
        claim="文字先到，意思后到。"
        body="逐字解密用的是 Canvas 量出来的字形宽度，不是等宽字符估算 —— 所以整个过程中字距一次都不跳。首页只解一个词，七秒一次；整句闪烁会变成噪音。"
        note="这一页我只解四个字。你能说清为什么是四个，才说明你真的控制得住它。"
        active={isActive('decrypted-text')}
      >
        <div className="flex h-full flex-col items-center justify-center px-6 py-16">
          <span className="text-h1 font-medium text-fg">
            <DecryptedText text="四个字" animateOn="hover" speed={45} />
          </span>
          <p className="mt-5 font-mono text-label text-faint">把指针移上来</p>
        </div>
      </Stage>

      <Stage
        id="tilt-card"
        index="05"
        distance="近 · 触感"
        claim="指针在哪，光就在哪。"
        body="倾斜角度按指针在卡片上的位置映射，越靠边缘转得越多。角度写进 CSS 变量直接改 style，不逐帧 setState —— 在低端机上，后者会把 pointermove 拖成掉帧。"
        note="悬停 120ms 跟手，离开 400ms expo 回弹。同一段 transform，两段手感，只靠一个 :hover 覆盖时长。"
        active={isActive('tilt-card')}
      >
        <div className="grid h-full place-items-center px-6 py-16 [perspective:900px]">
          <TiltCard className="w-full max-w-[300px] rounded-md">
            <div className="w-full rounded-md border border-line bg-surface/90 p-6">
              <p className="font-mono text-label tracking-[0.14em] text-faint">3D TILT</p>
              <p className="mt-2.5 text-meta text-fg">把指针移上来</p>
              <p className="mt-1.5 text-label leading-relaxed text-muted">
                倾斜量跟随指针位置，越靠边缘转得越多。
              </p>
            </div>
          </TiltCard>
        </div>
      </Stage>

      <Stage
        id="magnetic-button"
        index="06"
        distance="近 · 触感"
        claim="你还没碰到它，它已经在回应。"
        body="感应区比按钮本体大一圈，位移是「指针到中心的距离 × 0.34」。所以它是磁吸，不是跟随 —— 只在按钮内部响应，那叫 hover。"
        note="回弹完全交给 expo 曲线，不写 spring。物理感来自曲线形状，不来自逐帧积分。"
        active={isActive('magnetic-button')}
      >
        <div className="grid h-full place-items-center px-6 py-16">
          <MagneticButton>把指针靠近</MagneticButton>
        </div>
      </Stage>

      <Stage
        id="dock"
        index="07"
        distance="近 · 可达性"
        claim="距离就是可点击性的暗示。"
        body="离得越近，图标越大，这是指针距离驱动的弹性放大。它原本是全站导航，现在只是展品：Dock 的隐喻是「应用切换」，而一个阅读站需要的是「检索」。"
        note="一个效果最体面的下场，是被留在它适合的位置上，而不是被删掉。"
        active={isActive('dock')}
      >
        <div className="relative h-full min-h-[16rem] bg-bg">
          <p className="pointer-events-none absolute inset-x-0 top-10 text-center font-mono text-label text-faint">
            指针在图标上扫过
          </p>
          <Dock
            items={dockItems}
            position="bottom"
            theme={theme}
            baseItemSize={40}
            magnification={64}
            gap={8}
            roundness={0.5}
            showLabels={false}
          />
        </div>
      </Stage>

      <Stage
        id="glow-border"
        index="08"
        distance="特写 · 细节"
        claim="1.5px 是能看见的最小单位。"
        body="边框是一维的，用不着 SVG 也不用 canvas。把角度注册成 @property 可插值变量，conic-gradient 的旋转就整段跑在合成器上，主线程零成本。"
        note="第一版是 1px，在浅色底上几乎看不见。改到 1.5px 加一道亮芯才立住 —— 细节不是加法，是调到位。"
        active={isActive('glow-border')}
        tall
      >
        <div className="grid h-full place-items-center px-6 py-16">
          <GlowBorder className="w-full max-w-[400px]">
            <div className="px-6 py-9 text-center">
              <p className="font-mono text-label tracking-[0.14em] text-faint">GLOW BORDER</p>
              <p className="mt-2.5 text-meta text-fg">光沿边缘匀速走一圈</p>
              <p className="mt-1.5 text-label text-muted">4.5s 一圈，不快也不慢</p>
            </div>
          </GlowBorder>
        </div>
      </Stage>

      <section className="page-shell py-20">
        <h2 className="max-w-[24em] text-h2 font-medium tracking-[-0.011em] text-fg">
          这一页是体验，不是档案。
        </h2>
        <p className="mt-4 max-w-[52ch] text-meta leading-relaxed text-muted">
          八段看完，审美这件事其实说不清；但如果你记住了「一屏只跑一个」，
          那这一页就没白做。
        </p>

        <ul className="mt-10 max-w-[52ch] divide-y divide-line border-y border-line">
          {[
            { to: '/notes', label: '笔记', hint: '我读过的、踩过的、想明白的' },
            { to: '/craft', label: '工艺', hint: '上面八个效果的技术说明与拒绝理由' },
            { to: '/about', label: '关于', hint: '履历、擅长、联系方式' },
          ].map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="group flex items-center justify-between gap-4 py-4 transition-colors hover:text-fg"
              >
                <span className="flex items-baseline gap-3">
                  <span className="text-meta text-fg">{item.label}</span>
                  <span className="text-label text-faint">{item.hint}</span>
                </span>
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav aria-label="段落导航" className="me-progress">
        <ul className="me-progress__list">
          {SECTION_IDS.map((id) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="me-progress__link"
                aria-current={isActive(id)}
                aria-label={`跳到第 ${SECTION_IDS.findIndex((item) => item === id) + 1} 段`}
              >
                <span className="me-progress__tick" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
