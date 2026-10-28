import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { CommandPalette } from './CommandPalette'
import { Footer } from './Footer'
import { SiteNav } from './SiteNav'

export function SiteLayout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()

  // 全站只在这一处维护 <head>，新加页面就不用记得补标题
  useDocumentMeta(location.pathname)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // 路由切换：无锚点回到顶部，有锚点滚到目标。不能用 scrollRestoration，
  // 因为 BrowserRouter 不提供它，而这里的行为只有两种，手写更好控制。
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1))
      const frame = requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: 'start' })
      })
      return () => cancelAnimationFrame(frame)
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname, location.hash])

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[999] focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2 focus:text-meta focus:text-fg"
      >
        跳到正文
      </a>

      <SiteNav onOpenSearch={() => setSearchOpen(true)} />

      <main id="main" className="min-h-[70vh]">
        <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
