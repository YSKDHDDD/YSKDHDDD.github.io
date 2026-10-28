import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { isRoutePreloaded, preloadRoute } from '@/pages'
import { runViewTransition, withPreloadBudget } from '@/lib/routeTransition'
import { CommandPalette } from './CommandPalette'
import { Footer } from './Footer'
import { SiteNav } from './SiteNav'

/** 站内绝对路径才算内部链接；协议相对（//）与 mailto/hash 一律交还浏览器 */
function isInternalHref(href: string | null): href is string {
  return !!href && href.startsWith('/') && !href.startsWith('//')
}

/** /notes 与 /notes/ 是同一个路由，比较前先抹平尾斜杠 */
function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

export function SiteLayout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  /** 预热是异步的，期间用户可能又点了别的链接，用令牌丢掉过期的导航 */
  const navToken = useRef(0)

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

  /**
   * 路由过渡：用事件委托接管全站站内链接。
   *
   * 为什么不改 Link：站内有导航、列表卡片、文章正文、页脚四类入口，
   * MDX 里的链接还是 markdown 生成的 <a>，逐个改造一定会有漏网的。
   *
   * 为什么必须挂捕获阶段：React 的事件监听在 root 容器上，比 document 内层。
   * 冒泡阶段拦就已经晚了 —— Router 早把 history 推完了。捕获阶段先截断传播，
   * 才能保证只导航一次。
   */
  useEffect(() => {
    // 指针扫过和键盘聚焦都预热：键盘用户不产生 pointerover，不加 focusin 的话
    // 他们每次 Tab 到链接再回车都要多等一次 chunk
    const warm = (origin: EventTarget | null) => {
      if (!(origin instanceof Element)) return
      const anchor = origin.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (isInternalHref(href)) void preloadRoute(href)
    }

    const onPointerOver = (event: PointerEvent) => warm(event.target)
    const onFocusIn = (event: FocusEvent) => warm(event.target)

    const onClick = (event: MouseEvent) => {
      // 只接管「左键单击、无修饰键、非新窗口、非下载」这一种情况，其余全部放行
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!isInternalHref(href)) return

      // 带锚点的跳转靠浏览器接管更准，同页链接也没必要多演一次过渡
      if (href.includes('#') || normalizePath(href) === normalizePath(location.pathname)) return

      event.preventDefault()
      event.stopPropagation()

      const token = ++navToken.current

      const go = () => {
        if (token !== navToken.current) return
        runViewTransition(() => {
          // 快照只在回调前后各截一次，这里滚回顶部不会闪；
          // 不先复位的话，短的新页面会被浏览器 clamp 到自身底部，过渡就从页面中间开始。
          window.scrollTo({ top: 0, behavior: 'auto' })
          navigate(href)
        })
      }

      // chunk 没预热就先等它：过渡不能截到 Suspense 的空白帧
      if (isRoutePreloaded(href)) {
        go()
        return
      }
      void withPreloadBudget(preloadRoute(href)).then(go)
    }

    document.addEventListener('pointerover', onPointerOver, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('pointerover', onPointerOver, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [location.pathname, navigate])

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
