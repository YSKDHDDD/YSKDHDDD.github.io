import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Boxes, Code2, Images, Sparkles } from 'lucide-react'
import DecryptedText from '@/components/effects/DecryptedText'
import Dock, { type DockItemData } from '@/components/effects/Dock'
import GradientWaves from '@/components/effects/GradientWaves'
import SoftAurora from '@/components/effects/SoftAurora'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const dockItems: DockItemData[] = [
  { label: '笔记', icon: <Boxes size={18} aria-hidden />, onClick: () => undefined },
  { label: '复盘', icon: <Images size={18} aria-hidden />, onClick: () => undefined },
  { label: '工艺', icon: <Sparkles size={18} aria-hidden />, onClick: () => undefined },
  { label: '源码', icon: <Code2 size={18} aria-hidden />, onClick: () => undefined },
]

const swatches = [
  { name: 'bg', token: '--bg', note: '页面底色' },
  { name: 'surface', token: '--surface', note: '卡片' },
  { name: 'line', token: '--line', note: '分隔' },
  { name: 'fg', token: '--fg', note: '正文' },
  { name: 'muted', token: '--muted', note: '次要' },
  { name: 'brand', token: '--brand', note: '可交互' },
  { name: 'decision', token: '--decision', note: '决策' },
  { name: 'warn', token: '--warn', note: '注意' },
  { name: 'unverified', token: '--unverified', note: '待验证' },
]

const typeScale = [
  { name: 'display', size: '49px', className: 'text-display' },
  { name: 'h1', size: '31px', className: 'text-h1' },
  { name: 'h2', size: '25px', className: 'text-h2' },
  { name: 'h3', size: '20px', className: 'text-h3' },
  { name: 'body', size: '17px', className: 'text-body' },
  { name: 'meta', size: '13px', className: 'text-meta' },
  { name: 'label', size: '11px', className: 'text-label' },
]

const motions = [
  { name: 'micro', duration: 120, use: 'hover / focus' },
  { name: 'state', duration: 220, use: '主题、展开' },
  { name: 'enter', duration: 400, use: '入场 / 切页' },
]

function MotionDemo() {
  const [playing, setPlaying] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {motions.map((motion) => (
        <div key={motion.name} className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setPlaying(null)
              requestAnimationFrame(() => setPlaying(motion.duration))
            }}
            className="w-24 shrink-0 text-left font-mono text-label text-muted transition-colors hover:text-fg"
          >
            {motion.duration}ms
          </button>
          <div className="relative h-6 flex-1 overflow-hidden rounded-sm border border-line bg-bg">
            <span
              className={cn(
                'absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand',
                playing === motion.duration ? 'left-[calc(100%-14px)]' : 'left-1.5',
              )}
              style={{
                transitionProperty: 'left',
                transitionDuration: `${motion.duration}ms`,
                transitionTimingFunction: 'var(--motion-ease-soft)',
              }}
            />
          </div>
          <span className="w-24 shrink-0 text-label text-faint">{motion.use}</span>
        </div>
      ))}
    </div>
  )
}

export default function Craft() {
  const { theme } = useTheme()

  return (
    <div className="page-shell py-12 sm:py-16">
      <header className="max-w-[56ch]">
        <p className="font-mono text-label tracking-[0.14em] text-faint">CRAFT</p>
        <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">工艺</h1>
        <p className="mt-3 text-body text-muted">
          这里放的是效果的**证据**，不是效果本身。每个都标注了用了什么、为什么留，
          以及为什么大部分动效被拒绝了。
        </p>
      </header>

      <section aria-label="效果展品" className="mt-12 grid gap-4 lg:grid-cols-2">
        <article
          id="soft-aurora"
          className="scroll-mt-24 overflow-hidden rounded-md border border-line"
        >
          <div className="relative h-56 bg-bg">
            <SoftAurora className="absolute inset-0" lightMode={theme === 'light'} quality="medium" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg to-transparent" />
          </div>
          <div className="border-t border-line p-4">
            <h2 className="font-mono text-meta text-fg">SoftAurora</h2>
            <p className="mt-2 text-meta leading-relaxed text-muted">
              WebGL 片元着色器。首页只在空闲后挂载它，滚出首屏就随组件卸载。
              减少动效偏好下直接换成静态渐变，不加载着色器。
            </p>
          </div>
        </article>

        <article
          id="decrypted-text"
          className="scroll-mt-24 overflow-hidden rounded-md border border-line"
        >
          <div className="grid h-56 place-items-center bg-bg">
            <span className="text-h2 font-medium text-fg">
              <DecryptedText text="hover 我试试" animateOn="hover" speed={45} />
            </span>
          </div>
          <div className="border-t border-line p-4">
            <h2 className="font-mono text-meta text-fg">DecryptedText</h2>
            <p className="mt-2 text-meta leading-relaxed text-muted">
              逐字用 Canvas 度量字形宽度，避免解密过程中字距跳动。
              首页只用它解一个词，每 7 秒一次——整句闪烁会变成噪音。
            </p>
          </div>
        </article>

        <article
          id="gradient-waves"
          className="scroll-mt-24 overflow-hidden rounded-md border border-line"
        >
          <div className="relative h-56 bg-bg">
            <GradientWaves className="absolute inset-0" height={100} speed={0.35} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg to-transparent" />
          </div>
          <div className="border-t border-line p-4">
            <h2 className="font-mono text-meta text-fg">GradientWaves</h2>
            <p className="mt-2 text-meta leading-relaxed text-muted">
              2D Canvas 叠加正弦波。全站只用在一处：404 页。
              一个一年见一次的效果，才配得上常驻。
            </p>
          </div>
        </article>

        <article
          id="scroll-expand"
          className="scroll-mt-24 overflow-hidden rounded-md border border-line"
        >
          <div className="grid h-56 place-items-center bg-bg px-6 text-center">
            <p className="text-meta leading-relaxed text-faint">
              ScrollExpand 需要一个很长的滚动距离才能演示完整过程，
              在展位里跑只会得到一帧。所以这里不嵌入 —— 想看完整效果请到首页首屏。
            </p>
          </div>
          <div className="border-t border-line p-4">
            <h2 className="font-mono text-meta text-fg">ScrollExpand（未嵌入）</h2>
            <p className="mt-2 text-meta leading-relaxed text-muted">
              把滚动进度映射成 `width / height / border-radius` 的插值。
              「不为了展示而展示」也是这条工艺的一部分。
            </p>
          </div>
        </article>
      </section>

      <section id="dock" aria-label="Dock 展品" className="mt-4 scroll-mt-24">
        <div className="relative h-44 overflow-hidden rounded-md border border-line bg-bg-subtle">
          <Dock
            items={dockItems}
            position="bottom"
            theme={theme}
            baseItemSize={40}
            magnification={62}
            gap={8}
            roundness={0.5}
            showLabels={false}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-meta text-fg">Dock</h2>
          <p className="max-w-[64ch] text-label leading-relaxed text-faint">
            指针距离驱动的弹性放大。它原本是全站导航，现在只是展品：
            Dock 的隐喻是「应用切换」，而阅读站需要的是「检索」。
          </p>
        </div>
      </section>

      <section id="design-system" aria-label="设计系统" className="mt-16 scroll-mt-24">
        <h2 className="border-b border-line pb-3 text-h2 font-medium tracking-[-0.011em] text-fg">
          设计系统
        </h2>
        <p className="mt-3 max-w-[64ch] text-meta text-muted">
          下面这些不是文档，是真的在跑的那套令牌。切换右上角主题，色板会跟着变。
        </p>

        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="text-label tracking-[0.06em] text-faint">色彩 · 语义命名</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {swatches.map((swatch) => (
                <div key={swatch.name} className="overflow-hidden rounded-sm border border-line">
                  <div className="h-10" style={{ backgroundColor: `var(${swatch.token})` }} />
                  <div className="px-2 py-1.5">
                    <div className="font-mono text-label text-fg">{swatch.name}</div>
                    <div className="text-label text-faint">{swatch.note}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-label leading-relaxed text-faint">
              组件里只允许出现语义名，不允许出现 indigo-500 这类色板名 —— 换主题时不需要改任何组件。
            </p>
          </div>

          <div>
            <h3 className="text-label tracking-[0.06em] text-faint">字阶 · 只有 400 / 500 两个字重</h3>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {typeScale.map((row) => (
                <li key={row.name} className="flex items-baseline gap-4 py-2">
                  <span className="w-14 shrink-0 font-mono text-label text-faint">{row.name}</span>
                  <span className={cn('truncate font-medium text-fg', row.className)}>可读性</span>
                  <span className="ml-auto font-mono text-label text-faint">{row.size}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-label tracking-[0.06em] text-faint">动效 · 三档时长，可点播</h3>
            <div className="mt-3">
              <MotionDemo />
            </div>
            <p className="mt-3 text-label leading-relaxed text-faint">
              时长写进 `--motion-*` 变量，组件不许自己编。
              `prefers-reduced-motion` 下退化为静态首帧，而不是把速度调快。
            </p>
          </div>

          <div>
            <h3 className="text-label tracking-[0.06em] text-faint">栅格 · 三个容器宽度</h3>
            <ul className="mt-3 space-y-2 font-mono text-meta">
              <li className="flex justify-between border-b border-line pb-2">
                <span className="text-fg">1120px</span>
                <span className="text-faint">列表 / 工艺</span>
              </li>
              <li className="flex justify-between border-b border-line pb-2">
                <span className="text-fg">720px</span>
                <span className="text-faint">复盘阅读列</span>
              </li>
              <li className="flex justify-between border-b border-line pb-2">
                <span className="text-fg">680px</span>
                <span className="text-faint">笔记阅读列（34–38 字/行）</span>
              </li>
            </ul>
            <Link
              to="/notes/reading-width"
              className="mt-3 inline-flex items-center gap-1 text-label text-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="h-3 w-3 rotate-180" aria-hidden />
              为什么是 680：推导过程
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
