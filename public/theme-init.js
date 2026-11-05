/**
 * 首帧前定好主题。
 *
 * 这段逻辑原来是 index.html 里的一小段内联脚本。抽成文件是为了让 CSP 能写成
 * `script-src 'self'` —— 只要允许内联，就得带 'unsafe-inline'（或维护一个
 * 每次构建都可能变的 sha256），前者等于把这一条防护放弃掉一半。
 *
 * 代价是多一次请求，但它只有几百字节、同步执行、且在 <body> 之前完成，
 * 和原先内联时的行为完全一致：解析到这里就停下等待，属性设好才继续画第一帧。
 *
 * 必须是普通脚本（不是 type="module"）：module 默认 defer，会等文档解析完才跑，
 * 那时第一帧已经用错主题画出来了 —— 也就是闪烁。
 */
;(() => {
  try {
    const stored = localStorage.getItem('theme')
    const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    document.documentElement.dataset.theme = stored === 'light' || stored === 'dark' ? stored : system
  } catch {
    /* localStorage 不可用时退回默认深色 */
  }
})()
