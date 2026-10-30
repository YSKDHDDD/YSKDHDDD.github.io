import { ChromaGrid } from '@/components/effects/ChromaGrid'
import { PageWash } from '@/components/common/PageWash'
import { formatDate } from '@/lib/content'
import { momentPlaceholder } from '@/lib/momentPhoto'
import { moments } from '@/lib/moments'
import { useTheme } from '@/lib/theme'

/** 每张卡片描边的高亮色，跟六条记录的色调走，不额外定义新颜色 */
const ACCENTS = [
  'var(--decision)',
  'var(--topic-tooling)',
  'var(--topic-design)',
  'var(--decision)',
  'var(--topic-misc)',
  'var(--brand-2)',
] as const

/**
 * 生活：这个站唯一不需要「有用」的页面。
 *
 * 笔记和复盘都在给结论，这里只放证据 —— 傍晚的光、一座会变色的桥、相册里没删的一张。
 * 用 ChromaGrid 而不是普通图墙，是因为它默认是灰的：一屏灰照片像一叠还没冲出来的
 * 底片，指针扫过才显影，正好对上"记下来，是为了之后还想得起来"。
 */
export default function Life() {
  const { theme } = useTheme()

  const items = moments.map((moment, index) => ({
    image: moment.photo ?? momentPlaceholder(index),
    title: moment.title,
    subtitle: moment.note,
    meta: `${formatDate(moment.date)} · ${moment.place}`,
    accent: ACCENTS[index % ACCENTS.length],
    // 标题与这句补充都在卡片里，封面是纯装饰，再给 alt 只会让读屏念两遍
    alt: '',
  }))

  return (
    <div className="page-shell py-12 sm:py-16">
      <PageWash tone="life" />
      <header className="max-w-[52ch]">
        <p className="font-mono text-label tracking-[0.14em] text-brand-2">MOMENTS</p>
        <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">生活</h1>
        <p className="mt-3 text-body text-muted">
          这里不放大事。傍晚的光、一座会变色的桥、下雨那天留在相册里的一张 ——
          记下来不是因为特别，是因为之后还会想起来。
        </p>
      </header>

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2">
          <span className="font-mono text-label text-faint">{moments.length} 条记录</span>
          <span className="text-label text-faint">灰着的时候也认得出是哪天</span>
        </div>

        <ChromaGrid
          items={items}
          theme={theme}
          columns={3}
          minCardWidth={260}
          gap={14}
          radius={300}
          softness={0.62}
          aspectRatio="3 / 2"
          cardRadius={14}
          dim={0.1}
          glow={0.45}
          borderGlow={0.9}
        />
      </div>

      <p className="mt-8 border-t border-line pt-4 text-meta text-faint">
        照片大多还在手机里躺着，这里只放还会想起来的几张。
      </p>
    </div>
  )
}
