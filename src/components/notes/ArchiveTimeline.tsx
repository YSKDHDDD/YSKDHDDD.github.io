import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import type { EntryRow } from '@/hooks/useEntryRows'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { topicTone } from '@/lib/tone'
import './ArchiveTimeline.css'

/**
 * 归档时间轴。
 *
 * 骨架是「年份 → 圆环 → 逐日圆点」的竖轴（Fuwari 那类归档页的读法：
 * 日期在左贴轴，标题居中，标签贴右），动效借 reactbits 的 LineSidebar：
 * 指针靠近哪几行，那几行的轴点就放大、向右探出一截短线、标题往右滑动并染上主题色。
 *
 * 为什么不用 CSS :hover —— 那只有"悬停的那一行"会亮，观感是开关；
 * 这里要的是"一段连续的距离场"，靠近边缘的行也能提前半亮，指针移动时像光扫过去。
 * 所以每条行自己算 0..1 的 --effect，由一条 rAF 循环做帧率无关的指数逼近。
 */

/** 指针的影响半径。100 上下是"能感觉到、但不会一次点亮五行"的临界值 */
const RADIUS = 112
/** 逼近的时间常数（毫秒）。比 reactbits 默认的 100 略快，因为这里行更密 */
const TAU = 90

/** smoothstep：两端导数为 0，行与行之间的亮度过渡才不会在边界上"折"一下 */
const smooth = (p: number) => p * p * (3 - 2 * p)

/** 行已经按日期倒序排过，所以同年的一定相邻，一次遍历就能分组 */
function groupByYear(rows: EntryRow[]) {
  const groups: Array<{ year: string; rows: EntryRow[] }> = []
  for (const row of rows) {
    const year = row.meta.date.slice(0, 4)
    const tail = groups[groups.length - 1]
    if (tail && tail.year === year) tail.rows.push(row)
    else groups.push({ year, rows: [row] })
  }
  return groups
}

export function ArchiveTimeline({ rows }: { rows: EntryRow[] }) {
  const listRef = useRef<HTMLDivElement>(null)
  /** DOM 顺序里的所有行；测量和派发都走它，两处顺序天然一致 */
  const nodes = useRef<HTMLLIElement[]>([])
  const centers = useRef<number[]>([])
  const targets = useRef<number[]>([])
  const current = useRef<number[]>([])
  const raf = useRef<number | null>(null)
  const last = useRef(0)

  /*
    触屏没有"指针靠近"这回事：手指按下去那一刻就已经在目标上了，
    做距离场只会得到一堆半亮的行。所以只在真正有指针的设备上开启。
    减少动效同理 —— 这套效果的全部内容就是位移和连续变化。
  */
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)')
  const reduced = usePrefersReducedMotion()
  const live = canHover && !reduced

  const groups = useMemo(() => groupByYear(rows), [rows])

  /*
    循环体挂在 ref 上而不是直接引用自己。
    递归的 requestAnimationFrame(runFrame) 会被 react-hooks 判成"在声明前访问自己"，
    而且 useCallback(() => {…runFrame…}, []) 这种写法在依赖变化时拿到的是旧闭包。
  */
  const stepRef = useRef<(now: number) => void>(() => {})

  const runFrame = useCallback((now: number) => {
    const dt = Math.min((now - last.current) / 1000, 0.05)
    last.current = now
    /*
      1 - e^(-dt/τ) 而不是固定步长：显示器 60Hz 和 120Hz 上的观感必须一致，
      掉一帧也不会让动画"跳"一下。dt 上限 0.05 防止切标签页回来时一步到位。
    */
    const k = 1 - Math.exp(-dt / (TAU / 1000))

    let moving = false
    const items = nodes.current
    for (let i = 0; i < items.length; i += 1) {
      const el = items[i]
      if (!el) continue
      const target = targets.current[i] ?? 0
      const from = current.current[i] ?? 0
      const next = from + (target - from) * k
      // 差值小于半个千分位就吸附到目标值，否则循环永远不会停
      const settled = Math.abs(target - next) < 0.0015
      const value = settled ? target : next
      current.current[i] = value
      el.style.setProperty('--effect', value.toFixed(3))
      if (!settled) moving = true
    }

    raf.current = moving ? requestAnimationFrame((t) => stepRef.current(t)) : null
  }, [])

  useEffect(() => {
    stepRef.current = runFrame
  }, [runFrame])

  const kick = useCallback(() => {
    if (raf.current !== null) return
    last.current = performance.now()
    raf.current = requestAnimationFrame((t) => stepRef.current(t))
  }, [])

  /**
   * 行的中心统一换算成"相对列表顶部"的坐标，指针坐标用同一把尺子量。
   *
   * 不逐帧调用 getBoundingClientRect：那会在每次 pointermove 里读 20 多次布局。
   * 页面滚动不改变相对距离，所以只在挂载和尺寸变化时重测一次就够。
   */
  const measure = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const top = list.getBoundingClientRect().top
    nodes.current = Array.from(list.querySelectorAll<HTMLLIElement>('.tl__row'))
    centers.current = nodes.current.map((el) => {
      const box = el.getBoundingClientRect()
      return box.top - top + box.height / 2
    })
    targets.current = centers.current.map(() => 0)
    current.current = centers.current.map(() => 0)
    for (const el of nodes.current) el.style.setProperty('--effect', '0')
  }, [])

  useEffect(() => {
    if (!live) return
    measure()
    const list = listRef.current
    if (!list) return
    // 字体加载完、窗口缩放、天数变化都会让行高变 —— 中心点必须跟着重算
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [live, measure, rows])

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      raf.current = null
    },
    [],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!live) return
      const list = listRef.current
      if (!list) return
      const box = list.getBoundingClientRect()
      const y = event.clientY - box.top

      // 轴上的那道扫光跟着指针走：用 transform 而不是 top，避免每帧触发布局
      list.style.setProperty('--glow-y', `${y.toFixed(1)}px`)
      list.style.setProperty('--glow-o', '1')

      for (let i = 0; i < centers.current.length; i += 1) {
        const distance = Math.abs(y - centers.current[i])
        targets.current[i] = smooth(Math.max(0, 1 - distance / RADIUS))
      }
      kick()
    },
    [live, kick],
  )

  const onPointerLeave = useCallback(() => {
    if (!live) return
    listRef.current?.style.setProperty('--glow-o', '0')
    targets.current = targets.current.map(() => 0)
    kick()
  }, [live, kick])

  return (
    <div className="tl" ref={listRef} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <span className="tl__glow" aria-hidden />

      {groups.map((group) => (
        <section key={group.year} className="tl__year" aria-label={`${group.year} 年`}>
          <div className="tl__head">
            <h2 className="tl__year-label">{group.year}</h2>
            <span className="tl__year-count">{group.rows.length} 篇</span>
            <span className="tl__ring" aria-hidden />
          </div>

          <ul className="tl__rows">
            {group.rows.map((row) => {
              const tone = topicTone[row.meta.topic]
              return (
                <li
                  key={row.slug}
                  className="tl__row"
                  style={{ '--tone': tone } as CSSProperties}
                >
                  <Link to={row.href} className="tl__link">
                    <time className="tl__date" dateTime={row.meta.date}>
                      {row.meta.date.slice(5)}
                    </time>

                    {/*
                      标题和角标必须拆成两个节点：截断只发生在标题上。
                      写在一个 span 里的话，标题一超长，ellipsis 会把角标一起裁掉 ——
                      390px 下「清除 Vite 模板的 184 行残留」后面的「本地」就是这么没的。
                    */}
                    <span className="tl__title">
                      <span className="tl__title-text">{row.meta.title}</span>
                      {row.kind === '复盘' ? <span className="tl__badge">复盘</span> : null}
                      {row.local ? <span className="tl__badge">本地</span> : null}
                    </span>

                    <span className="tl__tags">
                      {row.meta.tags.slice(0, 2).map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </span>

                    <span className="tl__dot" aria-hidden />
                    <span className="tl__tick" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
