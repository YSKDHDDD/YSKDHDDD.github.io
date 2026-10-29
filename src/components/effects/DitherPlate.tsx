import { lazy, Suspense, useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import type { DitherVeilProps } from './DitherVeil'

const DitherVeil = lazy(() => import('./DitherVeil'))

/**
 * 首页的「图版」：把 DitherVeil 推迟到浏览器空闲后再加载。
 *
 * 三个理由，和 AuroraBackdrop 是同一套：
 * 1. 着色器 + 误差扩散是这一页最重的一块，不该跟首屏抢带宽；
 * 2. 这张图在首屏之外，早点加载也没人看得见；
 * 3. 减少动效偏好下根本不加载它 —— 那就只是一张照片，不是「不动起来的网点」。
 *
 * 在 JS 到位之前，这里渲染的就是那张照片本身（`object-cover`，尺寸和外层一致），
 * 所以布局不会跳，也不会出现一个空框。
 */
export function DitherPlate({ image, alt, className, ...rest }: DitherVeilProps) {
  const reduced = usePrefersReducedMotion()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (reduced) return undefined
    const idle: (cb: () => void) => number = window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 240))
    const cancel: (id: number) => void = window.cancelIdleCallback ?? ((id) => window.clearTimeout(id))
    const id = idle(() => setReady(true))
    return () => cancel(id)
  }, [reduced])

  const still = <img className={cn('block h-full w-full object-cover', className)} src={image} alt={alt} loading="lazy" decoding="async" />

  if (reduced || !ready) return still

  return (
    <Suspense fallback={still}>
      <DitherVeil image={image} alt={alt} className={className} {...rest} />
    </Suspense>
  )
}
