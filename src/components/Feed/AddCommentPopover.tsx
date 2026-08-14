import { useEffect, useState } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Reuses Tiptap's own floating-menu positioning (BubbleMenu) instead of
// hand-rolling selection-rect math. shouldShow restricts commenting to a
// selection that stays inside one already-saved entry, so a comment can
// never straddle two entries or attach to a not-yet-persisted block.
export function AddCommentPopover({
  editor,
  onSubmit,
}: {
  editor: Editor
  onSubmit: (text: string) => void
}) {
  const [composing, setComposing] = useState(false)
  const [text, setText] = useState('')

  const reset = () => {
    setComposing(false)
    setText('')
  }

  // BubbleMenu toggles visibility, it never unmounts — reset the composer
  // whenever the selection actually moves, so reopening it for a different
  // bit of text doesn't show a leftover draft from the last one.
  useEffect(() => {
    editor.on('selectionUpdate', reset)
    return () => {
      editor.off('selectionUpdate', reset)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    reset()
  }

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={0}
      shouldShow={({ editor: ed, from, to }) => {
        if (from === to) return false
        const $from = ed.state.doc.resolve(from)
        const $to = ed.state.doc.resolve(to)
        return $from.parent === $to.parent && !!$from.parent.attrs.entryId
      }}
      className="z-50 rounded-lg border bg-popover p-1.5 shadow-md"
    >
      {composing ? (
        <div className="w-64">
          <textarea
            autoFocus
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            className="w-full resize-none rounded-md border border-input bg-background p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') reset()
            }}
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button size="sm" variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={reset}>
              Cancel
            </Button>
            <Button size="sm" onMouseDown={(e) => e.preventDefault()} onClick={submit}>
              Comment
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-accent"
        >
          <MessageSquarePlus className="size-3.5" />
          Comment
        </button>
      )}
    </BubbleMenu>
  )
}
