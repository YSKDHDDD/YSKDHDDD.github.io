import { lazy, Suspense, useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const SoftAurora = lazy(() => import('./SoftAurora'))

/**
 * Hero 背景。三条约束：
 * 1. WebGL 模块在浏览器空闲后才加载，不抢首屏 JS；
 * 2. 减少动效偏好下不加载着色器，直接给一张静态渐变；
 * 3. 底部渐隐到 --bg，让极光"沉"进正文，而不是糊在标题后面。
 *
 * 曾经还有第四条 fadeToRight：首页首屏右侧压着不透明的墨色图版，得让光在撞上去
 * 之前收干净。首页首屏背景撤掉后没有调用方了，随属性一起删；现只剩 /me 一处在用。
 */
export function AuroraBackdrop({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion()
  const { theme } = useTheme()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (reduced) return
    const idle: (cb: () => void) => number =
      window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 220))
    const cancel: (id: number) => void =
      window.cancelIdleCallback ?? ((id) => window.clearTimeout(id))
    const id = idle(() => setReady(true))
    return () => cancel(id)
  }, [reduced])

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {ready && !reduced ? (
        <Suspense fallback={null}>
          <SoftAurora
            className="absolute inset-0"
            lightMode={theme === 'light'}
            quality="medium"
            speed={0.35}
            parallaxStrength={0.35}
            mouseInteraction={false}
            opacity={0.85}
          />
        </Suspense>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,var(--brand-soft),transparent_70%)]" />
      )}
      {/* 两个渐隐层：上方压暗标题区，下方把背景交还给正文 */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-bg via-bg/85 to-transparent" />
    </div>
  )
}
