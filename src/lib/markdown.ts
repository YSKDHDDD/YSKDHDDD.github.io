/**
 * 运行时 Markdown 渲染器 —— 只为「用户导入的本地文档」服务。
 *
 * 站点自身的笔记走 MDX，在构建期编译，能往正文里塞 React 组件。
 * 但导入的文件是运行期才出现的，构建期编译不了，所以需要一份运行时实现。
 *
 * 为什么手写而不是装 marked / markdown-it：
 * 1. 不给首屏加体积。这个模块只被 /import 与 /local 两个路由引用，独立分包；
 * 2. 安全边界更清楚。整个流程是「先转义、再套我自己生成的标签」，
 *    原文里的 HTML 一律变成文字，不存在漏一处的 XSS —— 这比引一个渲染器再加一个
 *    sanitizer 更难出错。代价是不支持内嵌 HTML，对个人文档来说这个限制是好事。
 *
 * 支持：标题、段落、围栏代码、引用、有序/无序列表（可嵌套）、GFM 表格、分隔线、
 * 行内代码、粗体、斜体、删除线、链接、图片、自动链接。够覆盖正常笔记。
 */

/** 中文按字、西文按词：与构建期笔记用同一套口径，两边的"几分钟"才有可比性 */
/**
 * 去掉和标题重复的一级标题。
 *
 * 页面上已经有 h1（来自 frontmatter 或首个标题），正文里再出现同一句就是重复。
 * 但只有当两者确实相同时才删 —— frontmatter 的 title 和正文第一个 # 不一致时，
 * 那个 # 是内容的一部分。
 */
export function stripTitleHeading(source: string, title: string): string {
  const match = /^\s*#\s+([^\n]+)\n+/.exec(source)
  if (!match) return source
  const normalize = (value: string) => value.replace(/[*_`~]/g, '').replace(/\s+/g, '').trim()
  return normalize(match[1]) === normalize(title) ? source.slice(match[0].length) : source
}

export function estimateReadingTime(source: string): number {
  const cjk = (source.match(/[\u4e00-\u9fa5]/g) ?? []).length
  const words = (source.match(/[a-zA-Z0-9]+/g) ?? []).length
  return Math.max(1, Math.round(cjk / 350 + words / 220))
}

export interface MarkdownHeading {
  depth: number
  text: string
  id: string
}

export interface RenderedMarkdown {
  html: string
  headings: MarkdownHeading[]
  readingTime: number
  /** 纯文本，用于生成摘要与搜索关键词 */
  plain: string
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => ESCAPES[char])
}

/** 只放行 http(s)、mailto、站内绝对路径与锚点；其余（javascript:、data: 之类）当普通文字 */
function safeUrl(url: string): string | null {
  const trimmed = url.trim()
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return escapeHtml(trimmed)
  if (/^[/#]/.test(trimmed)) return escapeHtml(trimmed)
  return null
}

/** 标题锚点：中文保留，标点折成连字符，重复的加序号（与 rehype-slug 的观感一致） */
function slugify(text: string, used: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section'
  const seen = used.get(base) ?? 0
  used.set(base, seen + 1)
  return seen === 0 ? base : `${base}-${seen}`
}

/*
  占位符用的是 Unicode 私用区字符（U+E000 / U+E001）而不是 \u0000：
  控制字符会被 eslint 拦，而且真实文档里偶尔真的会出现 NUL。
  私用区在正常文本里基本不可能出现，碰撞概率可以忽略。
*/
const PLACEHOLDER = /\uE000(\d+)\uE001/g
const HAS_PLACEHOLDER = /\uE000\d+\uE001/

/**
 * 行内规则。
 *
 * 传入的必须是**已转义**的文本。代码与链接先摘出来存进占位符，
 * 避免它们的内部再被后面的规则改写（`**a**` 出现在代码里时不该变粗体）。
 */
function renderInline(raw: string): string {
  const held: string[] = []
  const hold = (html: string) => `\uE000${held.push(html) - 1}\uE001`
  let text = raw

  text = text.replace(/`([^`\n]+)`/g, (_, code: string) => hold(`<code>${code}</code>`))

  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^)]*)&quot;)?\)/g,
    (match, alt: string, url: string, title?: string) => {
      const safe = safeUrl(url)
      if (!safe) return match
      const titleAttr = title ? ` title="${title}"` : ''
      return hold(
        `<img src="${safe}" alt="${alt}"${titleAttr} loading="lazy" decoding="async" />`,
      )
    },
  )

  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^)]*)&quot;)?\)/g,
    (match, label: string, url: string, title?: string) => {
      const safe = safeUrl(url)
      if (!safe) return match
      const external = /^https?:/i.test(url)
      const rel = external ? ' target="_blank" rel="noreferrer noopener"' : ''
      const titleAttr = title ? ` title="${title}"` : ''
      return hold(
        `<a href="${safe}"${titleAttr}${rel}>${renderInline(label)}</a>`,
      )
    },
  )

  text = text.replace(/&lt;((?:https?:\/\/|mailto:)[^\s&]+)&gt;/g, (_, url: string) =>
    hold(`<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">${url}</a>`),
  )

  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^\w])__([^_\n]+)__/g, '$1<strong>$2</strong>')
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  text = text.replace(/(^|[^\w])_([^_\n]+)_/g, '$1<em>$2</em>')
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>')

  // 占位符可能嵌套（链接文字里有粗体），多还原几轮
  for (let round = 0; round < 5 && HAS_PLACEHOLDER.test(text); round += 1) {
    text = text.replace(PLACEHOLDER, (_, index: string) => held[Number(index)] ?? '')
  }
  return text
}

const FENCE = /^\s*```\s*(\S*)\s*$/
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const UL_ITEM = /^(\s*)([-*+])\s+(.*)$/
const OL_ITEM = /^(\s*)(\d{1,9})[.)]\s+(.*)$/
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isTableStart(lines: string[], index: number): boolean {
  const header = lines[index]
  const divider = lines[index + 1]
  return !!header?.includes('|') && !!divider && TABLE_DIVIDER.test(divider) && divider.includes('-')
}

/** 一个块级起始行：段落遇到它就该停 */
function startsBlock(line: string, lines: string[], index: number): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    HR.test(line) ||
    /^\s*>/.test(line) ||
    UL_ITEM.test(line) ||
    OL_ITEM.test(line) ||
    isTableStart(lines, index)
  )
}

function stripTightParagraph(html: string): string {
  // 紧凑列表项不该被 <p> 包一层，否则每一条都多出上下行距
  if (html.startsWith('<p>') && html.indexOf('</p>') === html.length - 4) {
    return html.slice(3, -4)
  }
  return html
}

export function renderMarkdown(source: string): RenderedMarkdown {
  const usedSlugs = new Map<string, number>()
  const headings: MarkdownHeading[] = []
  const lines = source.replace(/\r\n?/g, '\n').split('\n')

  const renderBlocks = (blockLines: string[]): string => {
    const out: string[] = []
    let i = 0

    while (i < blockLines.length) {
      const line = blockLines[i]

      if (!line.trim()) {
        i += 1
        continue
      }

      const fence = FENCE.exec(line)
      if (fence) {
        const lang = fence[1]
        const buffer: string[] = []
        i += 1
        while (i < blockLines.length && !/^\s*```\s*$/.test(blockLines[i])) {
          buffer.push(blockLines[i])
          i += 1
        }
        i += 1
        const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
        out.push(`<pre><code${cls}>${escapeHtml(buffer.join('\n'))}</code></pre>`)
        continue
      }

      const heading = HEADING.exec(line)
      if (heading) {
        const depth = heading[1].length
        const rawText = heading[2]
        const text = rawText.replace(/[*_`~]/g, '')
        const id = slugify(text, usedSlugs)
        headings.push({ depth, text, id })
        out.push(`<h${depth} id="${id}">${renderInline(rawText)}</h${depth}>`)
        i += 1
        continue
      }

      if (HR.test(line)) {
        out.push('<hr />')
        i += 1
        continue
      }

      if (/^\s*>/.test(line)) {
        const quoted: string[] = []
        while (i < blockLines.length && /^\s*>/.test(blockLines[i])) {
          quoted.push(blockLines[i].replace(/^\s*>\s?/, ''))
          i += 1
        }
        out.push(`<blockquote>${renderBlocks(quoted)}</blockquote>`)
        continue
      }

      if (isTableStart(blockLines, i)) {
        const header = splitRow(blockLines[i])
        const aligns = splitRow(blockLines[i + 1]).map((cell) => {
          const left = cell.startsWith(':')
          const right = cell.endsWith(':')
          if (left && right) return 'center'
          if (right) return 'right'
          return 'left'
        })
        i += 2
        const rows: string[][] = []
        while (i < blockLines.length && blockLines[i].includes('|') && blockLines[i].trim()) {
          rows.push(splitRow(blockLines[i]))
          i += 1
        }
        const head = header
          .map(
            (cell, column) =>
              `<th style="text-align:${aligns[column] ?? 'left'}">${renderInline(cell)}</th>`,
          )
          .join('')
        const body = rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell, column) =>
                    `<td style="text-align:${aligns[column] ?? 'left'}">${renderInline(cell)}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('')
        out.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`)
        continue
      }

      const ordered = OL_ITEM.exec(line)
      const unordered = UL_ITEM.exec(line)
      if (ordered || unordered) {
        const baseIndent = (ordered ?? unordered)![1].length
        const tag = ordered ? 'ol' : 'ul'
        const items: string[] = []

        while (i < blockLines.length) {
          const marker = (ordered ? OL_ITEM : UL_ITEM).exec(blockLines[i])
          if (!marker || marker[1].length !== baseIndent) break

          const itemLines: string[] = [marker[3]]
          i += 1
          // 续行：缩进比列表标记深，或空行后面还跟着列表内容
          while (i < blockLines.length) {
            const next = blockLines[i]
            if (!next.trim()) {
              const after = blockLines[i + 1]
              if (after && (/^\s+/.test(after) || (ordered ? OL_ITEM : UL_ITEM).test(after))) {
                itemLines.push('')
                i += 1
                continue
              }
              break
            }
            const indent = /^\s*/.exec(next)![0].length
            if (indent > baseIndent) {
              itemLines.push(next.slice(Math.min(indent, baseIndent + 2)))
              i += 1
              continue
            }
            break
          }
          items.push(`<li>${stripTightParagraph(renderBlocks(itemLines))}</li>`)
        }

        out.push(`<${tag}>${items.join('')}</${tag}>`)
        continue
      }

      const paragraph: string[] = []
      while (
        i < blockLines.length &&
        blockLines[i].trim() &&
        (paragraph.length === 0 || !startsBlock(blockLines[i], blockLines, i))
      ) {
        paragraph.push(blockLines[i])
        i += 1
      }
      if (paragraph.length === 0) {
        // 理论上不会走到；兜底避免死循环
        i += 1
        continue
      }
      out.push(`<p>${renderInline(paragraph.join('\n').replace(/\n/g, ' '))}</p>`)
    }

    return out.join('\n')
  }

  const html = renderBlocks(lines)

  const plain = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^---[\s\S]*?---/, ' ')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    html,
    headings: headings.filter((heading) => heading.depth >= 2 && heading.depth <= 3),
    readingTime: estimateReadingTime(source),
    plain,
  }
}
