import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, Trash2 } from 'lucide-react'
import { PageWash } from '@/components/common/PageWash'
import { useLifeEntries } from '@/hooks/useLifeEntries'
import { formatDate } from '@/lib/content'

/**
 * 一条生活的详情。
 *
 * 网格上看到的是灰的、被裁成 3:2、只留一句话 —— 那是清单。点进来才是这张照片本身：
 * 原色、大方幅，配上当时的具体。所以这里不加任何特效，图就是图，字就是字。
 *
 * 顺序：日期地点 → 标题 → 卡片上那句 → 大图 → 正文。图放在标题之后而不是最前，
 * 是因为读者是从列表点进来的，需要先确认"点对了"，再往下看。
 *
 * 地址用 `?id=` 而不是 `/life/:id`：记录只存在本机，地址本来就不可分享，
 * 而静态托管下 `/life/:id` 没有对应文件，只能先落到 404.html 再由前端纠正 ——
 * 刷新会闪一下 404。/local 当初就是因为这一点改成查询参数的，这里沿用同一个判断。
 *
 * 不挂留言区：一条只在自己浏览器里存在的记录，谈不上"给谁看"，讨论串也没有意义。
 */
export default function LifeDetail() {
  const [params] = useSearchParams()
  const id = params.get('id') ?? ''
  const navigate = useNavigate()
  const { entries, loading, remove } = useLifeEntries()
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  const index = entries.findIndex((item) => item.id === id)
  const entry = index === -1 ? undefined : entries[index]
  const newer = index > 0 ? entries[index - 1] : undefined
  const older = index >= 0 && index < entries.length - 1 ? entries[index + 1] : undefined

  // 标题跟着记录走。列表页和详情页的 pathname 都是 /life，useDocumentMeta 不会重跑
  useEffect(() => {
    if (!entry) return
    const previous = document.title
    document.title = `${entry.title} · 生活`
    return () => {
      document.title = previous
    }
  }, [entry])

  // 确认态 4 秒后自己退回去，避免一个红色的按钮一直挂在那里
  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  if (loading) {
    return (
      <div className="page-shell flex items-center gap-2 py-24 text-meta text-faint">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        正在读本机记录…
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="page-shell py-24 text-center">
        <p className="font-mono text-label text-faint">404</p>
        <h1 className="mt-3 text-h2 text-fg">这条记录不在这台设备上</h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-meta leading-relaxed text-muted">
          六条示例谁打开都有；你自己添加的只存在写入它的那个浏览器里 ——
          换了设备、清过站点数据、或者刚把它删掉，都会落到这里。
        </p>
        <Link to="/life" className="mt-6 inline-block text-meta text-muted hover:text-fg">
          ← 回到生活
        </Link>
      </div>
    )
  }

  const total = String(entries.length).padStart(2, '0')

  /*
   * 参数写成 id 而不是闭包捕获 entry：TypeScript 不会把上面 `if (!entry)` 的
   * 收窄带进这个函数体，而在这里再断言一次「它一定存在」是把类型检查关掉，
   * 不如让调用点把 id 传进来。
   */
  async function handleRemove(targetId: string) {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setRemoving(true)
    try {
      await remove(targetId)
      navigate('/life', { replace: true })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <PageWash tone="life" />

      <div className="page-shell py-10 sm:py-14">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/life"
            className="group inline-flex items-center gap-1.5 text-meta text-faint transition-colors hover:text-fg"
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform duration-[var(--motion-fast)] group-hover:-translate-x-0.5"
              aria-hidden
            />
            生活
          </Link>

          <button
            type="button"
            onClick={() => handleRemove(entry.id)}
            disabled={removing}
            className="inline-flex items-center gap-1.5 text-label text-faint transition-colors hover:text-warn disabled:opacity-50"
          >
            {removing ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3 w-3" aria-hidden />
            )}
            {removing ? '删除中' : confirming ? '再点一次确认删除' : '删除这条'}
          </button>
        </div>

        <header className="mt-8 max-w-[760px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-label text-faint">
            <span style={{ color: entry.tone }}>
              {String(index + 1).padStart(2, '0')} / {total}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={entry.date}>{formatDate(entry.date)}</time>
            {entry.place ? (
              <>
                <span aria-hidden>·</span>
                <span>{entry.place}</span>
              </>
            ) : null}
            {entry.time ? (
              <>
                <span aria-hidden>·</span>
                <span>{entry.time}</span>
              </>
            ) : null}
          </div>

          <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">{entry.title}</h1>
          {entry.note ? <p className="mt-3 text-body text-muted">{entry.note}</p> : null}
        </header>

        {/* 900 是详情页的容器宽度上限：不做无谓的放大，也不裁掉边角 */}
        {/* view-transition-name 与 /life 网格里那张卡片同名，点开时图从卡片位置长过来 */}
        {entry.photoUrl ? (
          <figure className="mt-8 max-w-[900px]" style={{ viewTransitionName: `moment-${entry.id}` }}>
            <img
              src={entry.photoUrl}
              alt={entry.place ? `${entry.title}，拍摄于${entry.place}` : entry.title}
              width={entry.photoWidth}
              height={entry.photoHeight}
              className="block w-full rounded-lg border border-line bg-surface-2"
              // 首屏里最大的那张，交给浏览器优先取，别再让 lazy 推它一把
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </figure>
        ) : null}

        {/* 正文比标题栏窄一档，读起来不用左右扫 */}
        {entry.story.length ? (
          <div className="mt-10 max-w-[78ch] space-y-5">
            {entry.story.map((paragraph, position) => (
              <p key={`${position}-${paragraph.slice(0, 8)}`} className="text-body text-muted">
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}

        <nav
          aria-label="其他记录"
          className="mt-12 grid max-w-[900px] gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2"
        >
          {newer ? (
            <Link
              to={`/life?id=${newer.id}`}
              className="group bg-bg p-4 transition-colors hover:bg-surface"
            >
              <span className="flex items-center gap-1 text-label text-faint">
                <ArrowLeft className="h-3 w-3" aria-hidden /> 更新的一条
              </span>
              <span className="mt-1.5 block text-meta text-fg">{newer.title}</span>
            </Link>
          ) : (
            // 空着会像一个没加载出来的格子，所以明说为什么没有
            <div className="bg-bg p-4">
              <span className="text-label text-faint">已经是最新的一条</span>
            </div>
          )}
          {older ? (
            <Link
              to={`/life?id=${older.id}`}
              className="group bg-bg p-4 text-right transition-colors hover:bg-surface"
            >
              <span className="flex items-center justify-end gap-1 text-label text-faint">
                更早的一条 <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
              <span className="mt-1.5 block text-meta text-fg">{older.title}</span>
            </Link>
          ) : (
            <div className="bg-bg p-4 text-right">
              <span className="text-label text-faint">已经是最早的一条</span>
            </div>
          )}
        </nav>
      </div>
    </>
  )
}
