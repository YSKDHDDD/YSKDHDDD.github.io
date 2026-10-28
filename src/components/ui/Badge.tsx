import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'brand' | 'decision' | 'warn' | 'unverified'
}

const tones = {
  neutral: 'border-line text-muted',
  brand: 'border-brand/35 text-brand bg-brand-soft',
  decision: 'border-decision/35 text-decision bg-decision/10',
  warn: 'border-warn/35 text-warn bg-warn/10',
  unverified: 'border-unverified/35 text-unverified bg-unverified/10',
}

/** 小标签：11px / 500 / 字距 0.04em，承载元信息而不是装饰 */
export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-[3px]',
        'text-label font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
