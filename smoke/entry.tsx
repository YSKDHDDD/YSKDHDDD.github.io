import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuditNote from '../content/notes/reactbits-audit.mdx'
import RebuildRetro from '../content/retro/demo-app-rebuild.mdx'
import { mdxComponents } from '../src/components/mdx/registry'
import { ThemeProvider } from '../src/lib/theme'
import About from '../src/pages/About'
import Craft from '../src/pages/Craft'
import Home from '../src/pages/Home'
import NoteDetail from '../src/pages/NoteDetail'
import Notes from '../src/pages/Notes'
import NotFound from '../src/pages/NotFound'
import Retro from '../src/pages/Retro'
import RetroDetail from '../src/pages/RetroDetail'

const theme = { theme: 'dark' as const, toggle: () => undefined }

const cases: { name: string; path: string; element: ReactNode }[] = [
  { name: 'Home', path: '/', element: <Home /> },
  { name: 'Notes', path: '/notes', element: <Notes /> },
  { name: 'NoteDetail', path: '/notes/:slug', element: <NoteDetail /> },
  { name: 'Retro', path: '/retro', element: <Retro /> },
  { name: 'RetroDetail', path: '/retro/:slug', element: <RetroDetail /> },
  { name: 'Craft', path: '/craft', element: <Craft /> },
  { name: 'About', path: '/about', element: <About /> },
  { name: 'NotFound', path: '/nope', element: <NotFound /> },
]

const initialEntries: Record<string, string> = {
  NoteDetail: '/notes/reactbits-audit',
  RetroDetail: '/retro/demo-app-rebuild',
}

let failed = 0

for (const item of cases) {
  const entry = initialEntries[item.name] ?? item.path.replace(':slug', 'x')
  try {
    const html = renderToString(
      <ThemeProvider value={theme}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path={item.path} element={item.element} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )
    const meaningful = html.replace(/<[^>]+>/g, '').length
    console.log(`OK   ${item.name.padEnd(12)} html ${String(html.length).padStart(6)}  text ${String(meaningful).padStart(5)}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${item.name}`)
    console.error(error instanceof Error ? error.stack?.split('\n').slice(0, 8).join('\n') : error)
  }
}

// 正文 MDX：静态导入，绕过 lazy，直接验证自定义组件（Callout / DecisionCard / shiki）
for (const [name, Md] of [
  ['note.mdx', AuditNote],
  ['retro.mdx', RebuildRetro],
] as const) {
  try {
    const html = renderToString(<Md components={mdxComponents} />)
    const hasCallout = html.includes('待验证') || html.includes('决策')
    const hasCode = html.includes('<pre') || html.includes('data-rehype-pretty-code')
    console.log(`OK   ${name.padEnd(12)} html ${String(html.length).padStart(6)}  callout:${hasCallout} code:${hasCode}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : error)
  }
}

console.log(failed === 0 ? 'ALL RENDER' : `${failed} FAILED`)
