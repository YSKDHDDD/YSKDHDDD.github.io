import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/**
 * 归档已经并进笔记库（`/notes?view=timeline`），这一页只负责把旧地址送过去。
 *
 * 为什么不直接删掉路由：`/archive` 曾经预渲染成真实文件并且进过 sitemap，
 * 删了以后直接访问会落到 404.html —— 状态码 404、标题「页面不存在」，
 * 收藏夹里那条链接会以为站点坏了。所以它仍然被预渲染，只是 noindex：
 * 有文件、能跳转，但不参与索引。
 *
 * 为什么不用 `<Navigate>`：静态渲染时它只是个 useEffect 里的 navigate，
 * 在 StaticRouter 下必然 no-op，每次构建都会打一条警告。测试里这一行同样会
 * 被跳过，行为一致，不如直接把这个事实写出来。
 */
export default function Archive() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/notes?view=timeline', { replace: true })
  }, [navigate])

  return (
    <div className="page-shell py-16">
      <p className="text-body text-muted">归档已并入笔记库，正在跳转…</p>
      <Link
        to="/notes?view=timeline"
        className="mt-3 inline-block text-meta text-brand underline decoration-brand/40 underline-offset-4"
      >
        前往笔记库的时间线
      </Link>
    </div>
  )
}
