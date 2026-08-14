import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'
import { History } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { relativeTime, safeName, safeColor } from './utils'

export function EntryBlockView({ node }: NodeViewProps) {
  const { entryId, authorColor, authorName, updatedAt, createdAt, createdByName } = node.attrs

  const color = safeColor(authorColor)
  const author = safeName(authorName)
  const creator = createdByName ? safeName(createdByName) : author
  const wasEdited = !!(createdAt && updatedAt && Number(createdAt) !== Number(updatedAt))

  return (
    <NodeViewWrapper
      as="p"
      data-entry-id={entryId}
      className="group relative"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, white)` }}
    >
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              contentEditable={false}
              className="absolute -top-2.5 right-2 flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 shadow-sm outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <History className="size-2.5" />
          {creator} · {updatedAt ? relativeTime(Number(updatedAt)) : ''}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 text-sm" contentEditable={false}>
          <div className="flex items-center gap-2 font-medium">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
            {author}
          </div>
          <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {createdAt && (
              <p>
                Created by {creator}
                <br />
                {new Date(Number(createdAt)).toLocaleString()}
              </p>
            )}
            {wasEdited && (
              <p>
                Last edited by {author}
                <br />
                {new Date(Number(updatedAt)).toLocaleString()}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <NodeViewContent as="span" />
    </NodeViewWrapper>
  )
}
