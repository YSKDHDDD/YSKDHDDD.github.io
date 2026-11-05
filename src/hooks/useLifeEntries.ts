import { useCallback, useEffect, useRef, useState } from 'react'
import { lifeSource, type LifeEntry, type LifeDraft } from '@/lib/lifeStore'

export interface LifeEntryView extends LifeEntry {
  /**
   * 给 <img> 用的地址。
   *
   * 照片在库里是 Blob，直接塞进 src 是不行的，得先转成 object URL。
   * 转换放在这一层而不是每个卡片里各转一次：一张图转一次就够，
   * 列表重渲染时复用同一个 URL，图不会重新解码。
   */
  photoUrl?: string
}

/**
 * 读生活记录。
 *
 * 数据在本机 IndexedDB 里，所以第一次渲染是空的 —— 页面必须有一个明确的加载态，
 * 否则会先闪一下「还没有记录」，再突然长出一堆卡片，像是在骗人。
 */
export function useLifeEntries() {
  const [entries, setEntries] = useState<LifeEntryView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const urls = useRef(new Map<string, string>())

  const toView = useCallback((entry: LifeEntry): LifeEntryView => {
    if (!entry.photo) return entry
    let url = urls.current.get(entry.id)
    if (!url) {
      url = URL.createObjectURL(entry.photo)
      urls.current.set(entry.id, url)
    }
    return { ...entry, photoUrl: url }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const list = await lifeSource.list()
      setEntries(list.map(toView))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读不出本地记录')
    } finally {
      setLoading(false)
    }
  }, [toView])

  useEffect(() => {
    /*
     * 和 useLocalDocs 同一个写法：状态只在 then 里更新，effect 体里不直接 setState。
     * 直接 `void refresh()` 会被 lint 的 set-state-in-effect 判为级联渲染，
     * 而且这里还少了一层 `alive` —— 读库是异步的，回来时组件可能已经卸载。
     */
    let alive = true
    void lifeSource.list().then(
      (list) => {
        if (!alive) return
        setEntries(list.map(toView))
        setError(null)
        setLoading(false)
      },
      (cause: unknown) => {
        if (!alive) return
        setError(cause instanceof Error ? cause.message : '读不出本地记录')
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [toView])

  /**
   * 把已经不在列表里的 object URL 还回去。
   *
   * 不回收的话，删十条记录就白占十张图的解码内存，而且这个泄漏在页面上完全看不出来。
   */
  useEffect(() => {
    const live = new Set(entries.map((entry) => entry.id))
    for (const [id, url] of urls.current) {
      if (!live.has(id)) {
        URL.revokeObjectURL(url)
        urls.current.delete(id)
      }
    }
  }, [entries])

  useEffect(() => {
    const store = urls.current
    return () => {
      for (const url of store.values()) URL.revokeObjectURL(url)
      store.clear()
    }
  }, [])

  const add = useCallback(
    async (draft: LifeDraft) => {
      await lifeSource.add(draft)
      await refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await lifeSource.remove(id)
      await refresh()
    },
    [refresh],
  )

  return { entries, loading, error, add, remove, refresh }
}
