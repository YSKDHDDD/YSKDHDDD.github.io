/**
 * 「生活」的内容源。
 *
 * 和笔记/复盘分开：那两处是**结论**，这里是**证据** —— 没有论点、不标成熟度、
 * 不需要读完，只用来证明写代码的人还出门。
 *
 * 每条只需要四样东西：一句话的标题、一句补充、地点、日期。
 * `photo` 是 `src/assets/moments/` 里的实拍（统一裁成 3:2、900 宽、WebP）；
 * 留空则退回 `momentPhoto` 现画的虚焦光斑，所以增删条目不会出现空框。
 *
 * 顺序即展示顺序，日期递减 —— 卡片上印着日期，乱序会显得随意。
 * 季节也要对得上：荷塘在八月，晚霞在十月。
 */

import bridgeNight from '@/assets/moments/bridge-n.webp'
import cloud from '@/assets/moments/cloud.webp'
import collab from '@/assets/moments/collab.webp'
import dusk from '@/assets/moments/dusk.webp'
import lotus from '@/assets/moments/lotus.webp'
import rainWindow from '@/assets/moments/rain-win.webp'

export interface Moment {
  id: string
  /** 一句话，尽量具体到能看见画面 */
  title: string
  /** 比标题多给一点：温度、时间、当时在想什么 */
  note: string
  place: string
  /** ISO，便于排序与格式化 */
  date: string
  /** 真照片；留空则由 momentPlaceholder 顶替 */
  photo?: string
}

export const moments: Moment[] = [
  {
    id: 'rooftop-dusk',
    title: '屋顶那二十分钟',
    note: '太阳掉下去之后，云还亮了很久。风比屋里凉两度。',
    place: '天台',
    date: '2026-10-18',
    photo: dusk,
  },
  {
    id: 'highway-cloud',
    title: '高速上那片云',
    note: '一路没怎么说话。云长得比车走得快，到服务区才想起来拍一张。',
    place: '往北的路上',
    date: '2026-10-11',
    photo: cloud,
  },
  {
    id: 'color-bridge',
    title: '过桥时它换了三次色',
    note: '钢架上的灯一路变色，走在里面像走在一段还没剪完的片子里。',
    place: '过街天桥',
    date: '2026-09-28',
    photo: bridgeNight,
  },
  {
    id: 'saved-collab',
    title: '存下来没删的一张',
    note: '公告出来那天顺手存的。不玩也留着 —— 画得好就是画得好。',
    place: '相册',
    date: '2026-09-20',
    photo: collab,
  },
  {
    id: 'rain-window',
    title: '下雨那天的桌面',
    note: '窗上的水珠被人画了个心。换过很多张壁纸，就这张一直没换掉。',
    place: '屏幕',
    date: '2026-09-07',
    photo: rainWindow,
  },
  {
    id: 'lotus-bridge',
    title: '荷塘上那座桥',
    note: '八月最热的那几天，荷叶把水面全盖住了，桥底下一点风都没有。',
    place: '城南公园',
    date: '2026-08-02',
    photo: lotus,
  },
]
