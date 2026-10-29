import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Fuse from 'fuse.js'
import {
  BookOpen,
  Clock,
  CornerDownLeft,
  FileText,
  Hash,
  Home,
  Info,
  Moon,
  Palette,
  Rss,
  Search,
  Sun,
  Upload,
  User,
} from 'lucide-react'
import { searchIndex, tagIndex } from '@/lib/content'
import { useLocalDocs } from '@/hooks/useLocalDocs'
import { navLinks } from '@/lib/nav'
import { useTheme } from '@/lib/theme'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'

const BASE = import.meta.env.BASE_URL

/**
 * 命令面板，不是搜索框。
 *
 * 之前它只做一件事：在笔记和复盘里做模糊匹配。可它挂在 ⌘K 上、顶栏写着 Command，
 * 用户按下去期待的是「做点什么」—— 跳页面、换主题、看某个标签，都得回到鼠标上找。
 *
 * 现在所有可执行的东西都进同一个列表：动作、页面、标签、内容。搜索仍然走 Fuse，
 * 索引在构建期生成，不发请求。
 */
type GroupId = '动作' | '页面' | '标签' | '笔记' | '复盘' | '本地'

/** 分组是渲染顺序，不是匹配权重：动作永远在最上面，因为它是「命令」 */
const GROUP_ORDER: GroupId[] = ['动作', '页面', '标签', '本地', '笔记', '复盘']

/**
 * 每组最多几条。标签给得多：搜「标签」本身就是「我想看看都有什么标签」，
 * 只给 8 个等于把一半藏起来。内容少给几条，它本来就该靠输入更具体的词来收窄。
 */
const GROUP_LIMIT: Record<GroupId, number> = {
  动作: 6,
  页面: 8,
  标签: 12,
  本地: 5,
  笔记: 6,
  复盘: 4,
}

type Command = {
  id: string
  group: GroupId
  label: string
  hint?: string
  /** 参与模糊匹配，但不上屏：标签、近义词、英文别名 */
  keywords: string
  icon: ReactNode
  run: () => void
}

type Row = Command & { index: number }

const PAGE_ICONS: Record<string, ReactNode> = {
  '/notes': <BookOpen className="h-4 w-4" aria-hidden />,
  '/import': <Upload className="h-4 w-4" aria-hidden />,
  '/retro': <Clock className="h-4 w-4" aria-hidden />,
  '/craft': <Palette className="h-4 w-4" aria-hidden />,
  '/me': <User className="h-4 w-4" aria-hidden />,
  '/about': <Info className="h-4 w-4" aria-hidden />,
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  /*
    面板是常驻挂载的（SiteLayout 里一直在），所以在 /import 导入完再按 ⌘K，
    组件不会重新挂载、也就读不到新文档。每次打开时重读一次，代价是一次 IndexedDB 查询。
  */
  const { docs: localDocs, reload } = useLocalDocs()
  useEffect(() => {
    if (open) void reload()
  }, [open, reload])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = []

    list.push({
      id: 'theme',
      group: '动作',
      label: theme === 'dark' ? '切换到浅色主题' : '切换到深色主题',
      hint: theme === 'dark' ? '深色' : '浅色',
      keywords: 'theme dark light 主题 深色 浅色 外观 配色',
      icon:
        theme === 'dark' ? (
          <Sun className="h-4 w-4" aria-hidden />
        ) : (
          <Moon className="h-4 w-4" aria-hidden />
        ),
      run: toggle,
    })

    list.push({
      id: 'rss',
      group: '动作',
      label: '订阅 RSS',
      hint: 'rss.xml',
      keywords: 'rss 订阅 feed 通知',
      icon: <Rss className="h-4 w-4" aria-hidden />,
      run: () => window.open(`${BASE}rss.xml`, '_blank', 'noopener,noreferrer'),
    })

    list.push({
      id: 'page-home',
      group: '页面',
      label: '首页',
      hint: '/',
      keywords: 'home 首页 主页',
      icon: <Home className="h-4 w-4" aria-hidden />,
      run: () => navigate('/'),
    })

    for (const link of navLinks) {
      list.push({
        id: `page-${link.to}`,
        group: '页面',
        label: link.label,
        hint: link.to,
        keywords: `${link.to} 页面 导航`,
        icon: PAGE_ICONS[link.to] ?? <Info className="h-4 w-4" aria-hidden />,
        run: () => navigate(link.to),
      })
    }

    for (const [tag, count] of tagIndex) {
      list.push({
        id: `tag-${tag}`,
        group: '标签',
        label: `#${tag}`,
        hint: `${count} 篇`,
        keywords: `标签 tag ${tag}`,
        icon: <Hash className="h-4 w-4" aria-hidden />,
        run: () => navigate(`/notes?tag=${encodeURIComponent(tag)}`),
      })
    }

    /*
      本地文档排在站内笔记前面：它们刚被导入，用户按 ⌘K 十有八九就是在找它。
      但只给 5 条上限 —— 导入多了不该把"动作"和"页面"挤出第一屏。
    */
    for (const doc of localDocs) {
      list.push({
        id: `local-${doc.id}`,
        group: '本地',
        label: doc.title,
        hint: '本地',
        keywords: `${doc.tags.join(' ')} ${doc.summary} 本地 导入`,
        icon: <FileText className="h-4 w-4" aria-hidden />,
        run: () => navigate(`/local?id=${doc.id}`),
      })
    }

    for (const item of searchIndex) {
      list.push({
        id: `doc-${item.group}-${item.id}`,
        group: item.group,
        label: item.title,
        hint: item.group === '笔记' ? '笔记' : '复盘',
        keywords: `${item.tags.join(' ')} ${item.summary}`,
        icon:
          item.group === '笔记' ? (
            <BookOpen className="h-4 w-4" aria-hidden />
          ) : (
            <Clock className="h-4 w-4" aria-hidden />
          ),
        run: () => navigate(item.href),
      })
    }

    return list
  }, [theme, toggle, navigate, localDocs])

  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: ['label', 'keywords'],
        threshold: 0.36,
        ignoreLocation: true,
      }),
    [commands],
  )

  /**
   * 空查询时只列动作和页面，不塞「最近内容」。
   *
   * 按 ⌘K 的人要么想执行一件事，要么准备输入 —— 把六篇笔记垫在下面会让面板
   * 长到需要滚动，反而挡住了命令。找内容请直接打字。
   */
  const rows = useMemo<Row[]>(() => {
    const trimmed = query.trim()
    const matched: Command[] = trimmed
      ? fuse.search(trimmed).map((hit) => hit.item)
      : commands.filter((item) => item.group === '动作' || item.group === '页面')

    const grouped = GROUP_ORDER.map((group) => ({
      group,
      items: matched.filter((item) => item.group === group).slice(0, GROUP_LIMIT[group]),
    })).filter((bucket) => bucket.items.length > 0)

    let index = 0
    return grouped.flatMap((bucket) =>
      bucket.items.map((item) => ({ ...item, index: index++ })),
    )
  }, [commands, fuse, query])

  const groups = useMemo(() => {
    const buckets = new Map<GroupId, Row[]>()
    for (const row of rows) {
      const bucket = buckets.get(row.group)
      if (bucket) bucket.push(row)
      else buckets.set(row.group, [row])
    }
    return [...buckets.entries()]
  }, [rows])

  // 重置放在事件里而不是 effect 里：effect 里同步 setState 会多渲染一轮
  const changeQuery = (value: string) => {
    setQuery(value)
    setActive(0)
  }

  const close = () => {
    setQuery('')
    setActive(0)
    onOpenChange(false)
  }

  const exec = (row: Row | undefined) => {
    if (!row) return
    close()
    row.run()
  }

  // 列表比一屏长之后键盘选择会跑到视野外，得把它拉回来
  useEffect(() => {
    if (!open) return
    itemRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((prev) => (prev + 1) % Math.max(rows.length, 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((prev) => (prev - 1 + rows.length) % Math.max(rows.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      exec(rows[active])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      className="pt-[14vh]"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden />
        <input
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="搜索内容，或输入命令：主题、标签、RSS…"
          aria-label="命令与搜索"
          role="combobox"
          aria-expanded
          aria-controls="command-list"
          aria-activedescendant={rows[active] ? `command-${rows[active].index}` : undefined}
          className="h-12 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-faint"
        />
        <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-label text-faint">
          Esc
        </kbd>
      </div>

      <div
        id="command-list"
        role="listbox"
        aria-label="命令与搜索结果"
        className="max-h-[52vh] overflow-y-auto py-1.5"
      >
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-meta text-faint">没有匹配的命令或内容</p>
        ) : (
          groups.map(([group, items]) => (
            <div key={group} role="group" aria-label={group}>
              <div className="px-4 pt-2.5 pb-1 font-mono text-label tracking-[0.12em] text-faint">
                {group}
              </div>
              {items.map((row) => (
                <button
                  key={row.id}
                  id={`command-${row.index}`}
                  ref={(node) => {
                    itemRefs.current[row.index] = node
                  }}
                  type="button"
                  role="option"
                  aria-selected={row.index === active}
                  onMouseEnter={() => setActive(row.index)}
                  onClick={() => exec(row)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-left',
                    'transition-colors duration-[var(--motion-fast)]',
                    row.index === active ? 'bg-surface-2' : 'bg-transparent',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 transition-colors',
                      row.index === active ? 'text-brand' : 'text-faint',
                    )}
                  >
                    {row.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-meta text-fg">{row.label}</span>
                  {row.hint ? (
                    <span className="shrink-0 font-mono text-label text-faint">{row.hint}</span>
                  ) : null}
                  {row.index === active ? (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-label text-faint">
        <span>↑ ↓ 选择</span>
        <span>↵ 执行</span>
        <span className="ml-auto font-mono">{rows.length} 条</span>
      </div>
    </Dialog>
  )
}
