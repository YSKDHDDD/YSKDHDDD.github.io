import { LIFE_STORE, hasIndexedDb, tx } from './idb'
import { lifeSeeds } from './lifeSeed'

/**
 * 生活记录的数据源。
 *
 * 现在的实现是**只在本机**：照片和文字都进 IndexedDB，没有上传接口、没有账号、
 * 换一台设备就看不到自己发过什么。这一点必须同时写进界面文案 —— 「什么都不发生」
 * 是最难让人相信的一种隐私承诺。
 *
 * 唯一的例外是六条**示例记录**（`lifeSeed.ts`）：它们随站点打包，第一次打开时
 * 由 `ensureSeeded` 写进同一个 store。写完之后就和用户自己加的一样 —— 能点开、能删，
 * 删了不会再长出来。所以界面上要分清两件事：示例谁都看得见，你加的只有你看得见。
 *
 * 之所以还要抽一层 `LifeSource`，是因为以后要接云端：只换下面 `lifeSource` 那一行，
 * 页面代码一行都不用动。云端的契约就在这里定死，免得以后两边各猜一套：
 *
 *   GET    /api/life            → { items: LifeItem[] }，`LifeItem` 与 LifeEntry 同构，
 *                                  只是把 `photo: Blob` 换成 `photoUrl: string`
 *   POST   /api/life            → 201，multipart（照片 + 字段）
 *   DELETE /api/life/:id        → 204
 *
 * 三个接口都要求 `Authorization: Bearer <令牌>`，令牌由现有 Worker 的 GitHub 登录签发，
 * Worker 里比对登录名是否等于 OWNER —— 游客只能读，只有站主能写。照片存 R2，
 * D1 只存元信息和对象 key。
 *
 * 上传前的压缩留在前端做（见 `preparePhoto`），所以接云端时传输的是已经压到
 * 1600 宽的 WebP，和后端无关，两边不用写两套图片处理。
 */
export interface LifeEntry {
  id: string
  /** 一句话标题，尽量具体到能看见画面 */
  title: string
  /** 比标题多给一点：温度、时间、当时在想什么 */
  note: string
  /** 详情页正文。一段一件事，不抒情 */
  story: string[]
  place: string
  /** 拍下这张的时刻，详情页头部的元信息之一 */
  time: string
  /** ISO 日期，列表按它倒序 */
  date: string
  /** 压缩后的照片；没有照片时由 momentPlaceholder 顶替 */
  photo?: Blob
  /** 压缩后的尺寸，详情页据此预留高度，图加载完不跳动 */
  photoWidth?: number
  photoHeight?: number
  /** 卡片描边与详情页标记色，用现成的语义色变量 */
  tone: string
  createdAt: number
}

/** 表单产出的东西：还没有 id 和 tone */
export type LifeDraft = Omit<LifeEntry, 'id' | 'tone' | 'createdAt'>

export interface LifeSource {
  /** 界面上要如实告诉用户记录在哪，所以数据源自己报身份 */
  readonly kind: 'local' | 'remote'
  list(): Promise<LifeEntry[]>
  add(draft: LifeDraft): Promise<LifeEntry>
  remove(id: string): Promise<void>
}

/**
 * 色相按创建顺序轮转，不按内容猜。
 *
 * 六种色都来自现有的语义变量，不引入新颜色 —— 这个站的规则是
 * 「颜色只做标签，不做装饰」，生活页也不例外。
 */
const TONES = [
  'var(--decision)',
  'var(--topic-styling)',
  'var(--topic-content)',
  'var(--topic-reading)',
  'var(--brand-2)',
  'var(--topic-structure)',
] as const

const MAX_EDGE = 1600
const QUALITY = 0.82

function sortEntries(entries: LifeEntry[]): LifeEntry[] {
  return entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return b.createdAt - a.createdAt
  })
}

/* ---------- 照片：进库前先压到最长边 1600 ---------- */

export interface PreparedPhoto {
  blob: Blob
  width: number
  height: number
}

function loadImage(file: File): Promise<{ img: HTMLImageElement; release: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    const release = () => URL.revokeObjectURL(url)
    img.onload = () => resolve({ img, release })
    img.onerror = () => {
      release()
      // HEIC 在多数桌面浏览器里都解不开，报错要指向格式而不是「上传失败」
      reject(new Error('这个格式浏览器解不开（HEIC 常见），换成 JPG 或 PNG 再传'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片编码失败，换一张试试'))),
      // Safari 不支持 WebP 编码时会自己退回 PNG，所以这里不校验返回的 type
      'image/webp',
      QUALITY,
    )
  })
}

/**
 * 压到最长边 1600 再入库。
 *
 * 手机原图动辄 8–12MB，直接塞 IndexedDB 有两个后果：配额很快见底（Chrome 给的
 * 是「剩余磁盘的一定比例」，Safari 更紧），以及每次列表都要解码一张 4000px 的图。
 * 1600 放在详情页最大 900 宽的容器里仍然有 1.7 倍余量，放大不发虚。
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('这不是图片文件')

  const { img, release } = await loadImage(file)
  const source = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = source > MAX_EDGE ? MAX_EDGE / source : 1
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    release()
    throw new Error('这台设备的浏览器画不出 canvas，换一个再试')
  }

  context.drawImage(img, 0, 0, width, height)
  // 画完才能释放：Safari 上先 revoke 再 drawImage 会拿到空图
  release()

  return { blob: await canvasToBlob(canvas), width, height }
}

/* ---------- 播种：第一次打开时装上六条示例 ---------- */

/**
 * 用 localStorage 记一个「已经装过了」。
 *
 * IndexedDB 里非空也能判断，但用户把六条全删光之后库里就空了 —— 只看库，
 * 下次刷新会重新长出六条，等于把用户的删除操作撤销掉。所以要多一个只写一次的标记。
 */
const SEED_FLAG = 'life:seeded'

function hasSeeded(): boolean {
  try {
    return localStorage.getItem(SEED_FLAG) !== null
  } catch {
    /*
     * 隐私模式下 localStorage 会抛。这时没有别的一次性存储可用（IndexedDB 里再开一个
     * store 要升版本，为一句标记不值得），退化成每次进页面都补一遍缺 ——
     * 也就是删掉的示例会被补回来。这是隐私模式下的已知代价，写在注释里而不是假装没有。
     */
    return false
  }
}

function markSeeded(): void {
  try {
    localStorage.setItem(SEED_FLAG, String(Date.now()))
  } catch {
    /* 记不下就算了，记录本身已经落库 */
  }
}

async function seedOnce(): Promise<void> {
  if (!hasSeeded()) {
    /*
     * 按 id 补缺，而不是「库非空就整批跳过」：站主可能先传了几条自己的记录，
     * 示例照样该补齐。反过来说，播种标记一旦写下，这里就再不会进来 ——
     * 之后手动删掉的示例不会被这条逻辑捞回来。
     */
    const existing = await tx<LifeEntry[]>(LIFE_STORE, 'readonly', (store) => store.getAll())
    const present = new Set(existing.map((entry) => entry.id))

    for (const seed of lifeSeeds) {
      if (present.has(seed.id)) continue

      let photo: Blob | undefined
      try {
        const response = await fetch(seed.src)
        if (response.ok) photo = await response.blob()
      } catch {
        // 断网或资源被拦：照片留空走占位图，这条记录仍然要落进去
      }

      const entry: LifeEntry = {
        id: seed.id,
        title: seed.title,
        note: seed.note,
        story: seed.story,
        place: seed.place,
        time: seed.time,
        date: seed.date,
        photo,
        photoWidth: photo ? seed.width : undefined,
        photoHeight: photo ? seed.height : undefined,
        tone: seed.tone,
        // 拍照时刻当创建时间，排序里只有同一天的两条会用到它
        createdAt: Date.parse(`${seed.date}T${seed.time}:00`) || Date.now(),
      }
      await tx(LIFE_STORE, 'readwrite', (store) => store.put(entry))
    }

    markSeeded()
  }
}

/** 并发的 list 共用一个播种过程：列表页和它自己的一次重渲染不该装两遍 */
let seeding: Promise<void> | null = null

function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = seedOnce()
    // 失败不缓存，否则整个会话都读不到示例；下一次进页面再试
    seeding.catch(() => {
      seeding = null
    })
  }
  return seeding
}

/* ---------- 本机实现 ---------- */

export const localLifeSource: LifeSource = {
  kind: 'local',

  async list() {
    if (!hasIndexedDb()) return []
    try {
      // 装示例失败不该连累「读已有记录」，所以单独兜一层
      await ensureSeeded().catch(() => {})
      return sortEntries(await tx<LifeEntry[]>(LIFE_STORE, 'readonly', (store) => store.getAll()))
    } catch {
      // 隐私模式或存储被禁用：当作「还没有记录」，不要让整页挂掉
      return []
    }
  },

  async add(draft) {
    if (!hasIndexedDb()) throw new Error('这个浏览器不支持本地存储')

    const existing = await localLifeSource.list()
    const entry: LifeEntry = {
      ...draft,
      id: crypto.randomUUID(),
      tone: TONES[existing.length % TONES.length],
      createdAt: Date.now(),
    }

    try {
      await tx(LIFE_STORE, 'readwrite', (store) => store.put(entry))
    } catch (error) {
      /*
       * 配额满是最可能的一种失败，而且它的原始报错是 "QuotaExceededError"，
       * 用户看不懂也做不了什么。这里翻成人话，并给出唯一的出路。
       */
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'QuotaExceededError') {
        throw new Error('本地存储放不下了，删几条旧记录或者换一张小一点的图', { cause: error })
      }
      throw error
    }

    return entry
  },

  async remove(id) {
    if (!hasIndexedDb()) return
    await tx(LIFE_STORE, 'readwrite', (store) => store.delete(id))
  },
}

/**
 * 全站唯一的数据源出口。
 *
 * 接云端时把这一行换成 remote 实现即可 —— 页面只认 `LifeSource`，
 * 不认它背后是 IndexedDB 还是 R2。
 */
export const lifeSource: LifeSource = localLifeSource
