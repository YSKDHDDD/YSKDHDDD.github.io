/**
 * 全站唯一的 IndexedDB 入口。
 *
 * 现在有两个模块要存东西：导入的文档（`docs`）和生活记录（`moments`）。
 * 它们共用一个库 —— 多开一个库不是不行，但每个库都要各自维护版本号和升级逻辑，
 * 两处各写一遍，迟早会出现「A 已经升到 2，B 还拿着 1 去开」的情况：
 * 同一个库用低版本打开会直接抛 VersionError，而且**没有恢复手段**，用户只能清站点数据。
 *
 * 所以库名、版本号、建表全部收在这里。新增一个 store 只改 `DB_VERSION` 和常量，
 * 调用方永远只关心「打开、读写、关掉」。
 */

export const DB_NAME = 'exoself'

/**
 * 版本历史：
 * - v1：只有 `docs`（导入的 markdown）
 * - v2：新增 `moments`（生活记录）
 *
 * 升级只增不删：`onupgradeneeded` 里用 contains 兜底，老库补建新表，
 * 已有的数据一行都不动。
 */
const DB_VERSION = 2

export const DOCS_STORE = 'docs'
export const LIFE_STORE = 'moments'

export function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

let opening: Promise<IDBDatabase> | null = null

/**
 * 连接只建一次。
 *
 * 原先是每次操作都 open 再 close，那样两个模块各开各的、互不知情；
 * 改成共享连接之后，**事务结束时不能再 close**，否则下一次复用拿到的是已关闭的库。
 */
export function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) return Promise.reject(new Error('这个浏览器不支持本地存储'))
  if (opening) return opening

  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(LIFE_STORE)) {
        db.createObjectStore(LIFE_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    // 另一个标签页占着旧版本时会一直 blocked，不处理的话这里永远不 resolve
    request.onblocked = () => reject(new Error('另一个标签页正占着本地数据库，关掉它再试'))
  })

  opening = pending
  // 失败不要把拒绝结果永久缓存，否则一次偶发失败会让整个会话都用不了本地存储
  pending.catch(() => {
    opening = null
  })

  return pending
}

export function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const request = run(transaction.objectStore(store))

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        // 事务级失败（配额满、锁冲突）不一定会落到 request.onerror 上
        transaction.onabort = () => reject(transaction.error ?? new Error('本地存储写入被中止'))
      }),
  )
}
