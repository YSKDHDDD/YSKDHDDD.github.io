import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Command, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { navLinks } from '@/lib/nav'
import { cn } from '@/lib/utils'

export function SiteNav({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { theme, toggle } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full',
        'transition-[height,background-color,border-color] duration-[var(--motion-base)] ease-soft',
        scrolled
          ? 'h-14 border-b border-line bg-bg/80 backdrop-blur-xl'
          : 'h-16 border-b border-transparent bg-transparent',
      )}
    >
      <div className="page-shell flex h-full items-center justify-between gap-4">
        <Link
          to="/"
          className="group hit-44 relative flex items-center gap-2"
          aria-label="学习外脑 · 首页"
        >
          <span
            aria-hidden
            className="btn-brand grid h-6 w-6 place-items-center rounded-[6px] text-[11px] leading-none font-medium"
          >
            脑
          </span>
          <span className="hidden text-meta font-medium tracking-[-0.01em] text-fg sm:inline">
            学习外脑
          </span>
        </Link>

        <nav aria-label="主导航" className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  // whitespace-nowrap 必须有：目录挤在 390px 里时，flex 会按字数压缩宽度，
                  // 把「笔记」拆成一字一行。
                  // 七项目录 + 两个按钮在 390px 里放不下（实测会顶到主题按钮上），
                  // 所以窄屏只留五项：笔记 / 复盘 / 生活 / 工艺 / 我。
                  // 导入和关于在 390 下让位 —— 两者在页脚仍有入口，不算丢失。
                  'hit-y relative shrink-0 px-1.5 py-1.5 text-meta whitespace-nowrap transition-colors duration-[var(--motion-fast)] sm:px-2.5',
                  link.to === '/import' && 'hidden sm:inline-block',
                  link.to === '/about' && 'hidden md:inline-block',
                  isActive ? 'text-fg' : 'text-muted hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  {/* 当前项的下划线用品牌渐变：颜色是"你在哪"的信号，不是装饰 */}
                  <span
                    aria-hidden
                    className={cn(
                      'nav-underline absolute inset-x-2.5 -bottom-px h-[2px] rounded-full transition-opacity duration-[var(--motion-fast)]',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSearch}
            className={cn(
              'hit-44 relative flex h-8 items-center gap-2 rounded-sm border border-line px-1.5 text-faint sm:px-2',
              'transition-colors duration-[var(--motion-fast)] hover:border-line-strong hover:text-fg',
            )}
            aria-label="搜索（快捷键 Command K）"
          >
            <Command className="h-3.5 w-3.5" aria-hidden />
            {/* 手机上没有 ⌘K 这个键，留着字母只是白占宽度 */}
            <kbd className="hidden font-mono text-label sm:inline">K</kbd>
          </button>

          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
            className={cn(
              'hit-44 relative grid h-8 w-8 place-items-center rounded-sm text-faint',
              'transition-colors duration-[var(--motion-fast)] hover:bg-surface-2 hover:text-fg',
            )}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
