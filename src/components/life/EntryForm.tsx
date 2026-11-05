import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { preparePhoto, type LifeDraft } from '@/lib/lifeStore'
import { cn } from '@/lib/utils'

interface EntryFormProps {
  onSubmit: (draft: LifeDraft) => Promise<void>
  onCancel: () => void
}

const FIELD =
  'w-full rounded-md border border-line bg-bg px-3 py-2 text-meta text-fg outline-none transition-colors placeholder:text-faint focus:border-brand/45'

/** 本地时区的今天。`toISOString()` 是 UTC，晚上八点之后会算出明天 */
function todayLocal(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function nowLocal(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** 空行分段：一句一段，和详情页的排版一致 */
function splitStory(raw: string): string[] {
  return raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

export function EntryForm({ onSubmit, onCancel }: EntryFormProps) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [place, setPlace] = useState('')
  const [date, setDate] = useState(todayLocal)
  const [time, setTime] = useState(nowLocal)
  const [story, setStory] = useState('')
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const photoUrl = photo?.url
  // 换图或卸载时把上一张的 object URL 还回去
  useEffect(() => {
    if (!photoUrl) return
    return () => URL.revokeObjectURL(photoUrl)
  }, [photoUrl])

  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  function pick(file: File | undefined | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('只能选图片文件')
      return
    }
    setError(null)
    setPhoto({ file, url: URL.createObjectURL(file) })
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files?.[0])
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('至少写一句话标题 —— 卡片上就靠它认这张图')
      titleRef.current?.focus()
      return
    }

    setBusy(true)
    setError(null)
    try {
      const prepared = photo ? await preparePhoto(photo.file) : null
      await onSubmit({
        title: trimmedTitle,
        note: note.trim(),
        story: splitStory(story),
        place: place.trim(),
        time: time || nowLocal(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayLocal(),
        photo: prepared?.blob,
        photoWidth: prepared?.width,
        photoHeight: prepared?.height,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '没存进去，再试一次')
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-lg border border-line bg-surface/40 p-4 sm:p-5"
      aria-label="添加生活记录"
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <div>
          <label
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'group relative flex aspect-[3/2] cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed transition-colors',
              dragging ? 'border-brand bg-brand/5' : 'border-line bg-bg hover:border-brand/45',
            )}
          >
            {photo ? (
              <>
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    setPhoto(null)
                  }}
                  aria-label="移除这张照片"
                  className="absolute top-2 right-2 rounded-full bg-bg/85 p-1 text-fg transition-colors hover:text-warn"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </>
            ) : (
              <span className="flex flex-col items-center gap-1.5 px-4 text-center">
                <ImagePlus className="h-5 w-5 text-faint" aria-hidden />
                <span className="text-label text-muted">选一张照片，或拖进来</span>
                <span className="text-label text-faint">会压到 1600 宽再存，原图不落盘</span>
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => pick(event.target.files?.[0])}
            />
          </label>
          <p className="mt-2 text-label text-faint">不选照片也行，会用一张虚焦光斑顶上。</p>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="life-title" className="mb-1 block text-label text-muted">
              一句话标题
            </label>
            <input
              id="life-title"
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
              placeholder="屋顶那二十分钟"
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="life-note" className="mb-1 block text-label text-muted">
              卡片上那句补充
            </label>
            <input
              id="life-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={120}
              placeholder="太阳掉下去之后，云还亮了很久"
              className={FIELD}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label htmlFor="life-place" className="mb-1 block text-label text-muted">
                地点
              </label>
              <input
                id="life-place"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                maxLength={20}
                placeholder="天台"
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="life-date" className="mb-1 block text-label text-muted">
                日期
              </label>
              <input
                id="life-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="life-time" className="mb-1 block text-label text-muted">
                时刻
              </label>
              <input
                id="life-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className={FIELD}
              />
            </div>
          </div>
        </div>
      </div>

      {/*
        正文单独占一行，不塞进右列：它一多，右侧就被拉长，
        左边的照片框（3:2 固定）会剩下半列空白，整块看起来像没对齐。
      */}
      <div className="mt-3">
        <label htmlFor="life-story" className="mb-1 block text-label text-muted">
          正文 · 空行分段
        </label>
        <textarea
          id="life-story"
          value={story}
          onChange={(event) => setStory(event.target.value)}
          rows={4}
          placeholder="本来只是上楼收衣服。收完没立刻下去 —— 云看着要变，想站一会儿看它到底变成什么样。"
          className={cn(FIELD, 'resize-y leading-relaxed')}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-label text-faint" role="status">
          {error ?? '记录只存进这台设备的浏览器，不上传、不同步。'}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-meta text-muted transition-colors hover:text-fg disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-fg px-3.5 py-2 text-meta text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {busy ? '保存中' : '保存这条'}
          </button>
        </div>
      </div>
    </form>
  )
}
