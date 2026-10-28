import { Route, Routes } from 'react-router-dom'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { ThemeProvider, useThemeState } from '@/lib/theme'
import { About, Craft, Home, NoteDetail, NotFound, Notes, Retro, RetroDetail } from '@/pages'

/**
 * 页面从 '@/pages' 取，而不是在这里逐个 lazy()：
 * 预渲染构建会把同一个模块 alias 到同步版本，App 本身只有这一份。
 */
export default function App() {
  const themeState = useThemeState()

  return (
    <ThemeProvider value={themeState}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="notes" element={<Notes />} />
          <Route path="notes/:slug" element={<NoteDetail />} />
          <Route path="retro" element={<Retro />} />
          <Route path="retro/:slug" element={<RetroDetail />} />
          <Route path="craft" element={<Craft />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
