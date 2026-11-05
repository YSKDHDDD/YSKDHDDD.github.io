/**
 * 生活页的六条示例记录。
 *
 * 它们不属于「内容」，也不属于用户数据 —— 是随手点进来时该看到的东西。
 * 第一次打开生活页时由 `lifeStore` 一次性写进 IndexedDB（见 `ensureSeeded`），
 * 写完之后就和用户自己上传的记录没有区别：同样的卡片、同样的详情页、同样能删。
 *
 * 之所以走「播种进库」而不是在渲染时拼一个静态数组：
 * - 静态数组删不掉，页面会变成「示例删不完、自己的能删」的两套规则；
 * - 拼数组还要处理「删除后又被拼回来」，得额外存墓碑；
 * - 排序、编号、上一条/下一条全都在 entries 上算，多一个来源就要多改五处。
 *
 * 播种只发生一次（本机库里非空、或 localStorage 有标记就跳过），所以删掉之后
 * 刷新也不会再长出来 —— 那是用户的选择，不该被一段示例数据推翻。
 *
 * 图是 `src/assets/` 里的实拍，统一 900×600 WebP；比详情页容器（900）略有余量。
 * 云和荷塘两张同时被 `/craft` 的滚动背景用着，留在 `assets/` 根，这里直接引用。
 */

import bridgeNight from '@/assets/moments/bridge-n.webp'
import collab from '@/assets/moments/collab.webp'
import dusk from '@/assets/moments/dusk.webp'
import rainWindow from '@/assets/moments/rain-win.webp'
import cloud from '@/assets/cloud.webp'
import lotus from '@/assets/lotus.webp'

export interface LifeSeed {
  id: string
  title: string
  note: string
  story: string[]
  place: string
  time: string
  date: string
  /** 打包进站点的静态资源，播种时 fetch 成 Blob 再入库 */
  src: string
  width: number
  height: number
  tone: string
}

/**
 * 顺序即展示顺序，日期递减 —— 卡片上印着日期，乱序会显得随意。
 * 季节也要对得上：荷塘在八月，晚霞在十月。
 */
export const lifeSeeds: LifeSeed[] = [
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
    src: dusk,
    width: 900,
    height: 600,
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
    src: cloud,
    width: 900,
    height: 600,
    tone: 'var(--topic-delivery)',
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
    src: bridgeNight,
    width: 900,
    height: 600,
    tone: 'var(--topic-styling)',
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
    src: collab,
    width: 900,
    height: 600,
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
    src: rainWindow,
    width: 900,
    height: 600,
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
    src: lotus,
    width: 900,
    height: 600,
    tone: 'var(--brand-2)',
  },
]
