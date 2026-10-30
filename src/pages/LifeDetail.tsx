import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PageWash } from '@/components/common/PageWash'
import { formatDate } from '@/lib/content'
import { getMoment, getMomentNeighbours, moments } from '@/lib/moments'

/**
 * 一条生活的详情。
 *
 * 网格上看到的是灰的、被裁成 3:2、只留一句话 —— 那是清单。点进来才是这张照片本身：
 * 原色、大方幅，配上当时的具体。所以这里不加任何特效，图就是图，字就是字。
 *
 * 顺序：日期地点 → 标题 → 卡片上那句 → 大图 → 正文。图放在标题之后而不是最前，
 * 是因为读者是从列表点进来的，需要先确认"点对了"，再往下看。
 */
export default function LifeDetail() {
  const { id = '' } = useParams()
  const moment = getMoment(id)

  if (!moment) {
    return (
      <div className="page-shell py-24 text-center">
        <p className="font-mono text-label text-faint">404</p>
        <h1 className="mt-3 text-h2 text-fg">这条记录不存在</h1>
        <Link to="/life" className="mt-6 inline-block text-meta text-muted hover:text-fg">
          ← 回到生活
        </Link>
      </div>
    )
  }

  const { newer, older } = getMomentNeighbours(moment.id)
  const index = moments.findIndex((item) => item.id === moment.id) + 1
  const total = String(moments.length).padStart(2, '0')

  return (
    <>
      <PageWash tone="life" />

      <div className="page-shell py-10 sm:py-14">
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

        <header className="mt-8 max-w-[680px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-label text-faint">
            <span style={{ color: moment.tone }}>
              {String(index).padStart(2, '0')} / {total}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={moment.date}>{formatDate(moment.date)}</time>
            <span aria-hidden>·</span>
            <span>{moment.place}</span>
            <span aria-hidden>·</span>
            <span>{moment.time}</span>
          </div>

          <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">{moment.title}</h1>
          <p className="mt-3 text-body text-muted">{moment.note}</p>
        </header>

        {/* 900×600 是这批照片的原始尺寸，容器也封在 900：不做无谓的放大，也不裁掉边角 */}
        <figure className="mt-8 max-w-[900px]">
          <img
            src={moment.photo}
            alt={`${moment.title}，拍摄于${moment.place}`}
            width={900}
            height={600}
            className="block w-full rounded-lg border border-line bg-surface-2"
            // 首屏里最大的那张，交给浏览器优先取，别再让 lazy 推它一把
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </figure>

        {/* 正文用 62ch 的行宽，比标题栏窄一点，读起来不用左右扫 */}
        <div className="mt-10 max-w-[62ch] space-y-5">
          {moment.story.map((paragraph) => (
            <p key={paragraph} className="text-body text-muted">
              {paragraph}
            </p>
          ))}
        </div>

        <nav
          aria-label="其他记录"
          className="mt-12 grid max-w-[900px] gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2"
        >
          {newer ? (
            <Link to={`/life/${newer.id}`} className="group bg-bg p-4 transition-colors hover:bg-surface">
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
              to={`/life/${older.id}`}
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
