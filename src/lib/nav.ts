/**
 * 全站导航的唯一顺序来源。
 *
 * 顶栏和页脚各写一份时，顺序会悄悄漂移 —— 页脚曾经是「我 笔记 复盘 工艺 关于」，
 * 顶栏是「笔记 复盘 工艺 我 关于」，同一个站在两处给出两套目录。
 * 顺序只在这里改，两处同时跟上。
 */
export const navLinks = [
  { to: '/notes', label: '笔记' },
  { to: '/import', label: '导入' },
  { to: '/retro', label: '复盘' },
  { to: '/craft', label: '工艺' },
  { to: '/me', label: '我' },
  { to: '/about', label: '关于' },
] as const
