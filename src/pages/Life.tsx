import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { ChromaGrid } from '@/components/effects/ChromaGrid'
import { PageWash } from '@/components/common/PageWash'
import { EntryForm } from '@/components/life/EntryForm'
import { useLifeEntries } from '@/hooks/useLifeEntries'
import { formatDate } from '@/lib/content'
import { momentPlaceholder } from '@/lib/momentPhoto'
import { useTheme } from '@/lib/theme'

/**
 * 生活：这个站唯一不需要「有用」的页面。
 *
 * 笔记和复盘都在给结论，这里只放证据 —— 傍晚的光、一座会变色的桥、相册里没删的一张。
 * 用 ChromaGrid 而不是普通图墙，是因为它默认是灰的：一屏灰照片像一叠还没冲出来的
 * 底片，指针扫过才显影，正好对上"记下来，是为了之后还想得起来"。
 *
 * 记录由站主自己上传，**只存进这台设备的 IndexedDB**。前六条是随站点打包的示例，
 * 第一次打开时写进本机库（见 `lifeStore` 的 `seedIfEmpty`），此后的新增只有本机看得见。
 * 这个区别必须说清楚 —— 否则会以为「别人也能看到我发的」或者「换个浏览器数据丢了」。
 */
export default function Life() {
  const { theme } = useTheme()
  const { entries, loading, error, add } = useLifeEntries()
  const [adding, setAdding] = useState(false)

  const items = entries.map((entry, index) => ({
    image: entry.photoUrl ?? momentPlaceholder(index),
    title: entry.title,
    subtitle: entry.note,
    meta: [formatDate(entry.date), entry.place].filter(Boolean).join(' · '),
    accent: entry.tone,
    // 标题与这句补充都在卡片里，封面是纯装饰，再给 alt 只会让读屏念两遍
    alt: '',
    // 详情页用查询参数而不是 /life/:id：记录只在本机，地址对别人没有意义，
    // 而且 /life/:id 在静态托管下会先落到 404.html 再纠正，刷新会闪一下
    url: `/life?id=${entry.id}`,
    // 与详情页的 <figure> 同名：点开时图从卡片位置长成大图，而不是淡出再淡入
    viewTransitionName: `moment-${entry.id}`,
  }))

  return (
    <div className="page-shell py-12 sm:py-16">
      <PageWash tone="life" />
      <header className="max-w-[68ch]">
        <p className="font-mono text-label tracking-[0.14em] text-brand-2">MOMENTS</p>
        <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">生活</h1>
        <p className="mt-3 text-body text-muted">
          这里不放大事。傍晚的光、一座会变色的桥、下雨那天留在相册里的一张 ——
          记下来不是因为特别，是因为之后还会想起来。
        </p>
      </header>

      {adding ? (
        <EntryForm
          onSubmit={async (draft) => {
            await add(draft)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line pb-2">
          <span className="font-mono text-label text-faint">
            {loading ? '正在读本机记录…' : `${entries.length} 条记录 · 只在本机`}
          </span>
          <div className="flex items-center gap-4">
            {/* 这行是整页唯一的可点性提示：卡片默认是灰的，不说一句没人会去点 */}
            {entries.length ? <span className="text-label text-muted">点开看原色 ↗</span> : null}
            {adding ? null : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-label text-muted transition-colors hover:border-brand/45 hover:text-fg"
              >
                <Plus className="h-3 w-3" aria-hidden />
                添加记录
              </button>
            )}
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-warn/40 bg-warn/5 px-4 py-3 text-meta text-warn">
            {error}
          </p>
        ) : null}

        {!loading && entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
            <p className="text-h2 font-medium text-fg">还没有记录</p>
            <p className="mx-auto mt-2 max-w-[46ch] text-meta leading-relaxed text-muted">
              选一张照片、写一句话就能存下一条。照片会先压到 1600 宽再入库，
              原图不上传也不留副本 —— 记录只存在这个浏览器里。
            </p>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-fg px-3.5 py-2 text-meta text-bg transition-opacity hover:opacity-85"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              添加第一条
            </button>
          </div>
        ) : null}

        {items.length ? (
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
            linkAs={Link}
          />
        ) : null}
      </div>

      <p className="mt-8 border-t border-line pt-4 text-meta text-faint">
        前六条是随站点打包的示例，谁打开都看得到，也可以删；你之后添加的只存在这台设备的浏览器里，
        不上传、不同步，清掉站点数据就一起没了。
      </p>
    </div>
  )
}
