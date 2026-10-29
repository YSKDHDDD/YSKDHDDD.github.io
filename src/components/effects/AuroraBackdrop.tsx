import { lazy, Suspense, useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import './AuroraBackdrop.css'

const SoftAurora = lazy(() => import('./SoftAurora'))

/**
 * Hero 背景。四条约束：
 * 1. WebGL 模块在浏览器空闲后才加载，不抢首屏 JS；
 * 2. 减少动效偏好下不加载着色器，直接给一张静态渐变；
 * 3. 底部渐隐到 --bg，让极光"沉"进正文，而不是糊在标题后面。
 * 4. fadeToRight：首屏右侧有块不透明的墨色图版时，让光在撞上去之前先收干净，
 *    否则极光会在图版边缘被硬切成两段（详见 AuroraBackdrop.css）。
 */
export function AuroraBackdrop({
  className,
  fadeToRight = false,
}: {
  className?: string
  fadeToRight?: boolean
}) {
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
            className={cn('absolute inset-0', fadeToRight && 'aurora-fade-right')}
            lightMode={theme === 'light'}
            quality="medium"
            speed={0.35}
            parallaxStrength={0.35}
            mouseInteraction={false}
            opacity={0.85}
          />
        </Suspense>
      ) : (
        <div
          className={cn(
            'absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,var(--brand-soft),transparent_70%)]',
            fadeToRight && 'aurora-fade-right',
          )}
        />
      )}
      {/* 两个渐隐层：上方压暗标题区，下方把背景交还给正文 */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-bg via-bg/85 to-transparent" />
    </div>
  )
}
