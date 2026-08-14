import { useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { relativeTime, safeName, safeColor } from './utils'
import type { CommentDoc } from '@/services/comments'

export function CommentCard({
  comment,
  top,
  onDelete,
  onMeasure,
}: {
  comment: CommentDoc
  top: number
  onDelete: (comment: CommentDoc) => void
  onMeasure: (commentId: string, height: number) => void
}) {
  const author = safeName(comment.authorName)
  const color = safeColor(comment.authorColor)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const report = () => onMeasure(comment.commentId, el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [comment.commentId, onMeasure])

  return (
    <div
      ref={ref}
      className="group absolute left-0 w-full rounded-lg border bg-background p-2.5 text-sm shadow-sm"
      style={{ top }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          {author}
        </div>
        <button
          type="button"
          onClick={() => onDelete(comment)}
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-xs text-foreground">{comment.text}</p>
      <p className="mt-1.5 text-[10px] text-muted-foreground">{relativeTime(comment.createdAt)}</p>
    </div>
  )
}
