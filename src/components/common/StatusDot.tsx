import { statusHints, statusLabels, type NoteStatus } from '@/lib/content'
import { cn } from '@/lib/utils'

const tones: Record<NoteStatus, string> = {
  seedling: 'bg-unverified',
  growing: 'bg-decision',
  evergreen: 'bg-evergreen',
}

/** 状态点 + 文案。点本身不闪烁——闪烁会变成一个"常驻动效" */
export function StatusDot({
  status,
  className,
  showHint = false,
}: {
  status: NoteStatus
  className?: string
  showHint?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-label text-muted', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', tones[status])} aria-hidden />
      <span>{statusLabels[status]}</span>
      {showHint ? <span className="text-faint">· {statusHints[status]}</span> : null}
    </span>
  )
}
