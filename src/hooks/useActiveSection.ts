import { useEffect, useState } from 'react'

/**
 * 跟随滚动位置返回当前所在分区 id。
 * 判定逻辑：取「顶部已越过 offset 线」的最后一个分区，比 IntersectionObserver 更稳定，
 * 对超高（300vh）的 ScrollExpand 分区同样有效。
 */
export function useActiveSection(ids: readonly string[], offset = 140) {
  const [activeId, setActiveId] = useState(ids[0] ?? '')

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0

      let current = ids[0] ?? ''
      for (const id of ids) {
        const element = document.getElementById(id)
        if (!element) continue
        if (element.getBoundingClientRect().top - offset <= 0) current = id
      }

      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) current = ids[ids.length - 1] ?? current

      setActiveId((previous) => (previous === current ? previous : current))
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ids, offset])

  return activeId
}
