import { useCallback, useEffect, useState } from 'react'
import { listLocalDocs, type LocalDoc } from '@/lib/localDocs'

/**
 * 本地文档的读取。
 *
 * 只在这里做一次「挂载后读 IndexedDB」，理由：
 * 预渲染出的 HTML 里不可能有用户浏览器里的文档，任何在首次渲染就读取的写法
 * 都会让服务端和客户端算出不同的树，React 会丢掉整段 DOM 重建。
 * 所以 docs 的初始值恒为 []，读到之后再 set，差异只发生在 hydration 之后。
 */
export function useLocalDocs() {
  const [docs, setDocs] = useState<LocalDoc[]>([])
  const [ready, setReady] = useState(false)

  const reload = useCallback(async () => {
    const next = await listLocalDocs()
    setDocs(next)
    setReady(true)
    return next
  }, [])

  useEffect(() => {
    let alive = true
    void listLocalDocs().then((next) => {
      if (!alive) return
      setDocs(next)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  return { docs, ready, reload }
}
