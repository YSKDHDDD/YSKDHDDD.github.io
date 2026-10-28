import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

const container = document.getElementById('root')!

/**
 * 部署在子路径时（GitHub Pages 项目站点是 `/仓库名/`），路由必须知道这段前缀，
 * 否则 `<Link to="/notes">` 会把用户带到域名根目录，直接被 404 接走。
 *
 * BASE_URL 是 Vite 按 base 注入的，带尾斜杠；React Router 要的是不带尾斜杠的形状
 * （它用 `pathname.startsWith(basename + '/')` 匹配，多一个斜杠就匹配不上）。
 */
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

const tree = (
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>
)

/**
 * 构建产物里 #root 已经有预渲染好的 HTML，必须 hydrate 而不是重新渲染，
 * 否则浏览器会把整页 DOM 丢掉重建 —— 用户看到的就是「闪一下白」。
 * 开发服务器给的 index.html 是空容器，走 createRoot。
 */
if (container.hasChildNodes()) {
  hydrateRoot(container, tree)
} else {
  createRoot(container).render(tree)
}
