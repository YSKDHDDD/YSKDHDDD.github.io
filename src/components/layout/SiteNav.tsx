import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Command, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const links = [
  { to: '/notes', label: '笔记' },
  { to: '/retro', label: '复盘' },
  { to: '/craft', label: '工艺' },
  { to: '/about', label: '关于' },
]

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
        <Link to="/" className="group flex items-center gap-2" aria-label="学习外脑 · 首页">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-[6px] bg-brand text-[11px] leading-none font-medium text-white"
          >
            脑
          </span>
          <span className="hidden text-meta font-medium tracking-[-0.01em] text-fg sm:inline">
            学习外脑
          </span>
        </Link>

        <nav aria-label="主导航" className="flex items-center gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'relative px-2.5 py-1.5 text-meta transition-colors duration-[var(--motion-fast)]',
                  link.to === '/about' && 'hidden md:inline-block',
                  isActive ? 'text-fg' : 'text-muted hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-x-2.5 -bottom-px h-px bg-fg transition-opacity duration-[var(--motion-fast)]',
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
              'flex h-8 items-center gap-2 rounded-sm border border-line px-2 text-faint',
              'transition-colors duration-[var(--motion-fast)] hover:border-line-strong hover:text-fg',
            )}
            aria-label="搜索（快捷键 Command K）"
          >
            <Command className="h-3.5 w-3.5" aria-hidden />
            <kbd className="font-mono text-label">K</kbd>
          </button>

          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-sm text-faint',
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
