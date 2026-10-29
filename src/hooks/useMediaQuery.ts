import { useCallback, useSyncExternalStore } from 'react'

/**
 * 媒体查询的当前值。
 *
 * 用 useSyncExternalStore 而不是 useState + useEffect：订阅和退订天然配平，
 * 也不会出现「先渲染 false 再被 effect 改掉」的那一帧 —— 服务端快照明确是 false，
 * 预渲染产物和首帧就能对上，不会有 hydration 警告。
 *
 * 只在「要不要挂载」这种断点判断上用它。纯样式断点交给 Tailwind，
 * 不要为了一个 hidden 再引一次 JS 判断。
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
