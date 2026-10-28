import { useCallback, useContext, createContext, useMemo, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'theme'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * 主题的真相来源是 <html data-theme>，不是 React state。
 *
 * 因为 index.html 里的内联脚本必须在首帧绘制前就定好主题（否则会闪一下白），
 * 那一步发生在 React 之前。如果这里再用 useState 存一份，就会出现两个真相。
 *
 * 用 useSyncExternalStore 还有一个实际收益：它接受 server snapshot，
 * 预渲染时输出 dark、浏览器 hydration 后再切到用户真实偏好，不会触发 mismatch 警告。
 */
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function getServerSnapshot(): Theme {
  return 'dark'
}

function commit(next: Theme) {
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* 隐私模式下写不进去也不影响使用 */
  }
  for (const listener of listeners) listener()
}

export function useThemeState(): ThemeContextValue {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    commit(theme === 'dark' ? 'light' : 'dark')
  }, [theme])

  return useMemo(() => ({ theme, toggle }), [theme, toggle])
}

export const ThemeProvider = ThemeContext.Provider

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return value
}
