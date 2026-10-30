/**
 * 「生活」的内容源。
 *
 * 和笔记/复盘分开：那两处是**结论**，这里是**证据** —— 没有论点、不标成熟度、
 * 不需要读完，只用来证明写代码的人还出门。
 *
 * 每条分两层：
 * - `note` 一句话，只够印在卡片上；
 * - `story` 若干段，点进去才看 —— 卡片的灰照片加一句摘要，是这个页面的口气；
 *   真要看那张图到底拍到了什么，得点开。
 *
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
  /** 详情页正文。一段一件事，不抒情 —— 这里补的是卡片上没地方放的具体。 */
  story: string[]
  place: string
  /** 拍下这张的时刻，详情页头部的元信息之一 */
  time: string
  /** ISO，便于排序与格式化 */
  date: string
  /** 真照片；留空则由 momentPlaceholder 顶替 */
  photo?: string
  /** 卡片描边与详情页标记色，用现成的语义色变量，不额外定义新颜色 */
  tone: string
}

export const moments: Moment[] = [
  {
    id: 'rooftop-dusk',
    title: '屋顶那二十分钟',
    note: '太阳掉下去之后，云还亮了很久。风比屋里凉两度。',
    story: [
      '本来只是上楼收衣服。收完没立刻下去 —— 云看着要变，想站一会儿看它到底变成什么样。',
      '太阳其实已经落了，亮的是云。紫的那层最高，往下是橙，再往下就灰掉了。手机直出比眼睛看到的艳，压了两档才接近当时的样子。',
      '前后不到二十分钟，颜色就没了。下楼时天已经全黑，屋里的灯还没开。',
    ],
    place: '天台',
    time: '18:12',
    date: '2026-10-18',
    photo: dusk,
    tone: 'var(--decision)',
  },
  {
    id: 'highway-cloud',
    title: '高速上那片云',
    note: '一路没怎么说话。云长得比车走得快，到服务区才想起来拍一张。',
    story: [
      '上了高速就没再说话，各自看窗外。那片云一开始只在远处一个角，后来占了大半个天。',
      '云底是齐的，像被什么压过一刀。上面白得很厚，光从侧面来，边缘亮了一圈。',
      '到服务区停车才想起来拍。这会儿它已经变形了，不是一路上看的那个。所以这张其实是个迟到了的东西。',
    ],
    place: '往北的路上',
    time: '15:40',
    date: '2026-10-11',
    photo: cloud,
    tone: 'var(--topic-tooling)',
  },
  {
    id: 'color-bridge',
    title: '过桥时它换了三次色',
    note: '钢架上的灯一路变色，走在里面像走在一段还没剪完的片子里。',
    story: [
      '桥面的钢架上一排灯，从这头到那头颜色是流动的：先是蓝，走到一半变紫，快下桥的时候成了粉。',
      '站在中间往下看，车灯是一条条的线 —— 红的往这边，白的往那边。桥没动，是人在走。',
      '拍了七八张，只有这张把三种颜色都框进去。回去才发现左边边缘还站着个人。',
    ],
    place: '过街天桥',
    time: '20:36',
    date: '2026-09-28',
    photo: bridgeNight,
    tone: 'var(--topic-design)',
  },
  {
    id: 'saved-collab',
    title: '存下来没删的一张',
    note: '公告出来那天顺手存的。不玩也留着 —— 画得好就是画得好。',
    story: [
      '联动公告出来那天正在上班，摸鱼刷到，顺手存了。存完也没做什么，就是留在相册里。',
      '我不玩这个。留着是因为这张图本身够好：深蓝的底，红色只在一处，其余全收着。',
      '后来清过两次相册，删了不少截图，这张一直在。理由说不清楚，就是不想删。',
    ],
    place: '相册',
    time: '14:05',
    date: '2026-09-20',
    photo: collab,
    tone: 'var(--decision)',
  },
  {
    id: 'rain-window',
    title: '下雨那天的桌面',
    note: '窗上的水珠被人画了个心。换过很多张壁纸，就这张一直没换掉。',
    story: [
      '下雨那天下午没出门。玻璃上全是水珠，一颗一颗挂着，不往下走。',
      '不知道谁在玻璃上画了个心，也可能是我自己画的，记不清了。反正那会儿觉得该拍一张。',
      '后来设成壁纸，一设就是很久。换过好几轮，每次都觉得新的不如这张 —— 它不抢东西。',
    ],
    place: '屏幕',
    time: '16:20',
    date: '2026-09-07',
    photo: rainWindow,
    tone: 'var(--topic-misc)',
  },
  {
    id: 'lotus-bridge',
    title: '荷塘上那座桥',
    note: '八月最热的那几天，荷叶把水面全盖住了，桥底下一点风都没有。',
    story: [
      '八月最热那几天去的。荷叶长满了，一片叠一片，水面基本看不见。',
      '桥是石头的，不高，中间一个拱。站在桥底下比桥上还闷，一点风都没有。',
      '光全被荷叶接住了，水反而暗。绿是深的那种，不是鲜的。桥洞那块阴影刚好把画面分成两半。',
    ],
    place: '城南公园',
    time: '13:48',
    date: '2026-08-02',
    photo: lotus,
    tone: 'var(--brand-2)',
  },
]

/** 详情页按 id 取一条；找不到返回 undefined，由页面自己给 404 态 */
export function getMoment(id: string): Moment | undefined {
  return moments.find((moment) => moment.id === id)
}

/** 上一条 / 下一条。数组按日期递减，所以 newer 在数组里更靠前。 */
export function getMomentNeighbours(id: string): { newer?: Moment; older?: Moment } {
  const index = moments.findIndex((moment) => moment.id === id)
  if (index === -1) return {}
  return { newer: moments[index - 1], older: moments[index + 1] }
}
