/**
 * 工牌手感的数值测试台。
 *
 *   node scripts/lanyard-feel.ts
 *
 * 为什么要有这个文件：手感不能靠看截图判断，而无头浏览器里 rAF 基本不推进，
 * 拖拽只能跑一两帧。物理层（src/components/effects/lanyardPhysics.ts）不碰 DOM，
 * 可以在这里按 60fps 逐帧跑完整过程，把「跟手滞后多少像素、甩出去飞多远、
 * 荡几下停」打成表。改完参数先看这张表，再去浏览器里确认视觉。
 *
 * 两个量法上的坑：
 *   1. 手拖到绳子够不到的地方后，末端必然和手差一截（几何决定的），
 *      那不是「迟钝」。所以只在手处于可达范围内时统计滞后。
 *   2. 「飞多远」要累加逐帧位移，不能只看首尾差 —— 卡片会来回甩。
 */

import { Lanyard, SEGMENTS, TUNING } from '../src/components/effects/lanyardPhysics.ts'

const DT = 1 / 60
const W = 300
const H = 629
const DEG = 180 / Math.PI
const pad = (s: string | number, n: number) => String(s).padStart(n)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const tip = (l: Lanyard) => l.points[SEGMENTS]

/** 新建一个已经静止下来的实例 */
function fresh() {
  const l = new Lanyard()
  l.resize(W, H)
  for (let i = 0; i < 240; i += 1) l.step(DT)
  return l
}

/** 从静止位向右匀速拖 dist 像素 */
function drag(l: Lanyard, speed: number, dist = 100) {
  const x0 = tip(l).x
  const y0 = tip(l).y
  l.beginDrag(x0, y0)
  const frames = Math.max(2, Math.round(dist / (speed * DT)))
  let maxLag = 0
  let swingPeak = 0
  for (let i = 1; i <= frames; i += 1) {
    const raw = x0 + (dist * i) / frames
    l.moveHand(raw, y0)
    l.step(DT)
    // 只有手还在绳子够得到的地方，滞后才有意义
    if (raw === clamp(raw, l.bounds.minX, l.bounds.maxX)) {
      maxLag = Math.max(maxLag, Math.abs(raw - tip(l).x))
    }
    swingPeak = Math.max(swingPeak, Math.abs(l.swing) * DEG)
  }
  return { maxLag, swingPeak }
}

/** 松手后逐帧采样：飞多远、摆多大、多久停 */
function release(l: Lanyard, max = 600) {
  l.endDrag()
  let travel = 0
  let prev = tip(l).x
  let swingPeak = 0
  let settle = -1
  for (let i = 0; i < max; i += 1) {
    l.step(DT)
    travel += Math.abs(tip(l).x - prev)
    prev = tip(l).x
    swingPeak = Math.max(swingPeak, Math.abs(l.swing) * DEG)
    if (settle < 0 && l.isSettled()) settle = i
  }
  return { travel, swingPeak, settle: settle < 0 ? -1 : settle * DT }
}

const geo = fresh().geometry
const reach = Math.sqrt(geo.ropeLen ** 2 - (geo.restTop - geo.anchorY) ** 2)
console.log(
  `容器 ${W}x${H}  卡片 ${geo.cardW}x${geo.cardH}  绳长 ${geo.ropeLen}px  静止位可横移 ±${(Math.round(reach * 10) / 10).toFixed(1)}px（再远就要抬升）`,
)
console.log('')

console.log('— 拖动 100px：跟手滞后 —')
console.log('速度        峰值滞后   拖动中摆角')
for (const v of [150, 400, 800, 1500, 2600]) {
  const r = drag(fresh(), v)
  console.log(`${pad(v, 5)}px/s ${pad(r.maxLag.toFixed(1), 9)}px ${pad(r.swingPeak.toFixed(1), 9)}°`)
}

console.log('')
console.log('— 拖 100px 后松手 —')
console.log('速度        飞行距离   摆角峰值   停稳')
for (const v of [150, 400, 800, 1500, 2600]) {
  const l = fresh()
  drag(l, v)
  const r = release(l)
  console.log(
    `${pad(v, 5)}px/s ${pad(r.travel.toFixed(0), 8)}px ${pad(r.swingPeak.toFixed(1), 9)}° ${pad(r.settle < 0 ? '>10s' : r.settle.toFixed(2) + 's', 6)}`,
  )
}

console.log('')
console.log('— 按住不动 0.5 秒再松手（应该不甩） —')
{
  const l = fresh()
  drag(l, 800)
  for (let i = 0; i < 30; i += 1) l.step(DT)
  const r = release(l)
  console.log(
    `飞行 ${r.travel.toFixed(0)}px  摆角峰值 ${r.swingPeak.toFixed(1)}°  停稳 ${r.settle < 0 ? '>10s' : r.settle.toFixed(2) + 's'}`,
  )
}

console.log('')
console.log(
  `参数：gravity ${TUNING.gravity} · damping ${TUNING.damping} · passes ${TUNING.passes} · pullBase ${TUNING.pullBase} · swingZeta ${TUNING.swingZeta}`,
)
