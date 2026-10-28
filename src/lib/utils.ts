import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并类名：clsx 处理条件拼接，tailwind-merge 处理冲突覆盖
 * （后面的同类工具类覆盖前面的，例如 px-2 与 px-4）
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
