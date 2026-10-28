import { notes, retros } from './content'
import { SITE, absoluteUrl } from './site'

export interface PageMeta {
  title: string
  description: string
  path: string
  canonical: string
  type: 'website' | 'article'
  published?: string
  modified?: string
  tags?: string[]
  /** 404 与草稿页不让搜索引擎收录 */
  noindex?: boolean
}

/**
 * 唯一的「路径 → 元信息」映射。
 *
 * 客户端（导航后更新 <head>）和构建期（写进每个 index.html）都调这一个函数，
 * 所以浏览器里的标题和爬虫看到的一定一致 —— 这正是之前全站共用一个 <title> 的根因。
 */
export function resolveMeta(pathname: string): PageMeta {
  const clean = pathname.replace(/\/+$/, '') || '/'
  const base = (path: string, rest: Omit<PageMeta, 'path' | 'canonical'>): PageMeta => ({
    ...rest,
    path,
    canonical: absoluteUrl(path),
  })

  if (clean === '/') {
    return base('/', {
      title: `${SITE.name} · ${SITE.tagline}`,
      description: SITE.description,
      type: 'website',
    })
  }

  const segments = clean.split('/').filter(Boolean)

  if (segments[0] === 'notes') {
    if (segments.length === 1) {
      const topics = new Set(notes.map((note) => note.meta.topic)).size
      return base('/notes', {
        title: `笔记 · ${SITE.name}`,
        description: `${notes.length} 篇技术笔记，覆盖 ${topics} 个主题。每篇都标注成熟度：萌芽、成长中、常青 —— 让「这篇还能不能信」一眼可见。`,
        type: 'website',
      })
    }

    const note = notes.find((item) => item.slug === segments[1])
    if (note) {
      return base(`/notes/${note.slug}`, {
        title: `${note.meta.title} · ${SITE.name}`,
        description: note.meta.summary,
        type: 'article',
        published: note.meta.date,
        modified: note.meta.updated,
        tags: note.meta.tags,
      })
    }
  }

  if (segments[0] === 'retro') {
    if (segments.length === 1) {
      return base('/retro', {
        title: `复盘 · ${SITE.name}`,
        description: `${retros.length} 个项目复盘。不写「学到了很多」，只写当时有哪些选项、选了哪个、代价是什么。`,
        type: 'website',
      })
    }

    const retro = retros.find((item) => item.slug === segments[1])
    if (retro) {
      return base(`/retro/${retro.slug}`, {
        title: `${retro.meta.title} · ${SITE.name}`,
        description: retro.meta.summary,
        type: 'article',
        published: retro.meta.date,
        modified: retro.meta.updated,
        tags: retro.meta.tags,
      })
    }
  }

  if (segments[0] === 'me') {
    return base('/me', {
      title: `我 · ${SITE.name}`,
      description:
        '一条观看路径：从氛围、结构、文本，到触感与 1.5px 的细节。八段滚动叙事，每段只放一个效果，一屏只跑一个。',
      type: 'website',
    })
  }

  if (segments[0] === 'craft') {
    return base('/craft', {
      title: `工艺 · ${SITE.name}`,
      description:
        '这个站点用到的界面工艺：效果预算、字阶与间距、动效时长、可访问性取舍。每一条都能在源码里找到落点。',
      type: 'website',
    })
  }

  if (segments[0] === 'about') {
    return base('/about', {
      title: `关于 · ${SITE.name}`,
      description: '关于这个外脑的定位、写作原则，以及为什么它长成现在这样。',
      type: 'website',
    })
  }

  return base('/404', {
    title: `页面不存在 · ${SITE.name}`,
    description: '这个地址没有对应的内容。',
    type: 'website',
    noindex: true,
  })
}

/** 序列化成 <head> 里的标签，构建期直接塞进模板 */
export function headTags(meta: PageMeta): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const tags = [
    `<title>${escape(meta.title)}</title>`,
    `<meta name="description" content="${escape(meta.description)}" />`,
    `<link rel="canonical" href="${escape(meta.canonical)}" />`,
    `<meta property="og:site_name" content="${escape(SITE.name)}" />`,
    `<meta property="og:locale" content="${SITE.locale.replace('-', '_')}" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta property="og:title" content="${escape(meta.title)}" />`,
    `<meta property="og:description" content="${escape(meta.description)}" />`,
    `<meta property="og:url" content="${escape(meta.canonical)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escape(meta.title)}" />`,
    `<meta name="twitter:description" content="${escape(meta.description)}" />`,
  ]

  if (meta.type === 'article') {
    if (meta.published) {
      tags.push(`<meta property="article:published_time" content="${meta.published}" />`)
    }
    if (meta.modified) {
      tags.push(`<meta property="article:modified_time" content="${meta.modified}" />`)
    }
    for (const tag of meta.tags ?? []) {
      tags.push(`<meta property="article:tag" content="${escape(tag)}" />`)
    }
  }

  if (meta.noindex) {
    tags.push('<meta name="robots" content="noindex" />')
  }

  // JSON-LD：让搜索结果能显示成「文章」而不是普通链接
  const jsonLd =
    meta.type === 'article'
      ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          // headline 用文章名本身，不带「 · 学习外脑」后缀 —— 搜索结果里站点名会单独展示
          headline: meta.title.replace(` · ${SITE.name}`, ''),
          description: meta.description,
          datePublished: meta.published,
          dateModified: meta.modified ?? meta.published,
          url: meta.canonical,
          author: { '@type': 'Person', name: SITE.author },
          inLanguage: SITE.locale,
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE.name,
          description: SITE.description,
          url: SITE.url,
          inLanguage: SITE.locale,
        }

  tags.push(
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  )

  return tags.join('\n    ')
}
