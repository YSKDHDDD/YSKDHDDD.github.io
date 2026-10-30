/**
 * 「生活」页的占位照片：还没有自己的照片时，现画一张失焦光斑图顶上。
 *
 * 为什么不是一块灰色占位框：ChromaGrid 的显影靠「灰度层 + 彩色层」两张图叠起来，
 * 图是效果的主体，留白框会让整页看着像没加载完。这里画的是一张**虚焦的夜景**：
 * 深底 + 十几个散开的柔光斑 + 颗粒 —— 照片的语言，也是"光"的语言，和这个站
 * 一直在讲的"让光进来"是一回事。
 *
 * 换成真照片只要把 `moments.ts` 里那条的 `photo` 填上就行，这个模块自动让位。
 * 体积 2–3KB 一张（SVG data URI，同源、无请求）；灰度化之后靠光斑位置区分，
 * 六张不会糊成一样。
 */

/**
 * 每个位置一组色：主光 / 副光 / 底色 / 曝光（0 最暗、1 最亮）
 *
 * 顺序跟 `moments.ts` 对齐 —— 六条现在都有实拍，这里只在某条漏填 `photo` 时顶上，
 * 所以配色要照着那条的照片挑，兜底才不会显得突兀。
 */
const PALETTES: readonly [string, string, string, number][] = [
  ['#ff8a4c', '#ffb224', '#1a0d06', 0.85], // 01 屋顶：落日
  ['#3ea6ff', '#bfe4ff', '#04101c', 1], // 02 高速：积云与天
  ['#f472b6', '#7b6cff', '#120816', 0.4], // 03 过桥：夜里的彩灯
  ['#2f4a8a', '#e0416a', '#0a0f1e', 0.6], // 04 联动图：深蓝与红
  ['#d9557a', '#f0a8bd', '#1a0a10', 0.55], // 05 雨窗：粉与暗
  ['#34d399', '#a3e635', '#08150f', 0.7], // 06 荷塘：叶绿
]

const W = 900
const H = 600

/** 定种子的线性同余：同一序号每次构建画出来一样，否则每次 build 产物都变 */
const rng = (seed: number) => {
  let s = seed * 2654435761
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/**
 * @param index 这条记录在列表中的位置，决定配色与光斑分布
 */
export function momentPlaceholder(index: number): string {
  const [a, b, base, exposure] = PALETTES[index % PALETTES.length]
  const next = rng(index + 1)
  const round = (v: number) => Math.round(v)

  // 十几个光斑：越靠画面中心越大越亮，像虚焦的灯
  const bokeh: string[] = []
  for (let i = 0; i < 15; i++) {
    const cx = round(60 + next() * (W - 120))
    const cy = round(50 + next() * (H - 100))
    const r = round(16 + next() * 66)
    const tone = i % 3 === 0 ? b : a
    const op = ((0.1 + next() * 0.3) * (0.55 + exposure * 0.6)).toFixed(3)
    bokeh.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${tone}" fill-opacity="${op}"/>`,
    )
  }
  // 一条贯穿画面的光带，把散点收拢成"照片"而不是"噪点"
  const bandY = round(120 + next() * 300)
  const bandA = ((0.35 + next() * 0.25) * (0.6 + exposure * 0.5)).toFixed(2)
  // 顶部漏进来的天光。六张的曝光差全靠这一层，否则灰度化之后全是一个亮度
  const skyOp = (0.12 + exposure * 0.5).toFixed(2)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0.4" y2="1">
<stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="#03050a"/>
</linearGradient>
<radialGradient id="top" cx="26%" cy="4%" r="82%">
<stop offset="0" stop-color="${a}" stop-opacity="${skyOp}"/>
<stop offset="1" stop-color="${a}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="band" x1="0" y1="0" x2="1" y2="0.3">
<stop offset="0" stop-color="${a}" stop-opacity="0"/>
<stop offset="0.45" stop-color="${a}" stop-opacity="${bandA}"/>
<stop offset="1" stop-color="${b}" stop-opacity="0"/>
</linearGradient>
<radialGradient id="vig" cx="50%" cy="48%" r="72%">
<stop offset="0.42" stop-color="#000" stop-opacity="0"/>
<stop offset="1" stop-color="#000" stop-opacity="${(0.62 - exposure * 0.16).toFixed(2)}"/>
</radialGradient>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
<feGaussianBlur stdDeviation="26"/>
</filter>
<filter id="soft2" x="-30%" y="-30%" width="160%" height="160%">
<feGaussianBlur stdDeviation="9"/>
</filter>
<pattern id="grain" width="9" height="9" patternUnits="userSpaceOnUse">
<circle cx="2" cy="2" r="0.9" fill="#fff" fill-opacity="0.07"/>
<circle cx="6" cy="5" r="0.7" fill="#fff" fill-opacity="0.05"/>
</pattern>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#top)"/>
<rect y="${bandY}" width="${W}" height="${round(60 + next() * 90)}" fill="url(#band)" filter="url(#soft)"/>
<g filter="url(#soft)">${bokeh.slice(0, 8).join('')}</g>
<g filter="url(#soft2)">${bokeh.slice(8).join('')}</g>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
<rect width="${W}" height="${H}" fill="url(#grain)"/>
</svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
