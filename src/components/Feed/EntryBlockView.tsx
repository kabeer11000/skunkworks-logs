import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'
import { History, GitCommit, Sparkles, Bot } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { relativeTime, safeName, safeColor } from './utils'

export function EntryBlockView({ node }: NodeViewProps) {
  const { entryId, authorColor, authorName, updatedAt, createdAt, createdByName, source, viaToken } = node.attrs
  const isIngested = source === 'github'
  const isSummary = source === 'ai-summary'
  const SourceIcon = isSummary ? Sparkles : GitCommit

  const color = safeColor(authorColor)
  const author = safeName(authorName)
  const creator = createdByName ? safeName(createdByName) : author
  const wasEdited = !!(createdAt && updatedAt && Number(createdAt) !== Number(updatedAt))

  // Rendered directly rather than via Tiptap's Placeholder extension —
  // ReactNodeViewRenderer's update() skips re-rendering when only
  // decorations change and the node reference hasn't (see its source:
  // "ProseMirror renders decorations independently on the contentDOM"),
  // so Placeholder's is-empty/data-placeholder decoration never reaches a
  // custom NodeView's wrapper at all.
  //
  // isComposer (explicitly managed by ensureLeadingComposer in
  // Feed/index.tsx) — not raw emptiness — decides whether this shows the
  // composer's dashed-border placeholder look. A real entry that happens to
  // be empty (e.g. edited down to nothing) should look like a plain blank
  // entry, not the composer.
  const isComposer = !!node.attrs.isComposer && node.content.size === 0
  const isCleaning = !!node.attrs.cleaning

  return (
    <NodeViewWrapper
      as="p"
      data-entry-id={entryId}
      className={`group relative ${isComposer ? 'border border-dashed border-neutral-300' : ''} ${
        isSummary ? 'border-l-2 border-violet-300' : ''
      }`}
      style={{
        backgroundColor: isComposer || isSummary ? undefined : `color-mix(in srgb, ${color} 12%, white)`,
        backgroundImage: isSummary
          ? 'linear-gradient(to right, color-mix(in srgb, #7c3aed 12%, white), white)'
          : undefined,
      }}
    >
      {isSummary && (
        <span
          contentEditable={false}
          className="pointer-events-none absolute -top-5 left-2 flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-600"
        >
          <Sparkles className="size-2.5" />
          AI Summary
        </span>
      )}
      {isComposer && (
        <span
          contentEditable={false}
          className="pointer-events-none absolute text-neutral-400"
        >
          Click to start typing, all your changes autosave… Type @ to mention someone, [[ to reference a drain or entry.
        </span>
      )}
      {!isComposer && <Popover>
        {/* Sits above the padding box entirely (-top-6, clear of the text's
            own top padding) so it never overlaps the actual text glyphs —
            a pill sitting -top-2.5 (inside the box) previously intercepted
            the mousedown/mouseup of a text-selection drag ending near that
            corner. Safe to keep pointer-events on even while hidden now,
            since there's nothing selectable in the gap above the card. */}
        <PopoverTrigger
          render={
            <button
              type="button"
              contentEditable={false}
              className="absolute -top-6 right-2 flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 shadow-sm outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          {isIngested || isSummary ? <SourceIcon className="size-2.5" /> : <History className="size-2.5" />}
          {creator} · {updatedAt ? relativeTime(Number(updatedAt)) : ''}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 text-sm" contentEditable={false}>
          <div className="flex items-center gap-2 font-medium">
            {isIngested || isSummary ? (
              <SourceIcon className="size-3 shrink-0" />
            ) : (
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
            )}
            {author}
          </div>
          <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {viaToken && (
              <p className="flex items-center gap-1 text-violet-600">
                <Bot className="size-3" />
                via {viaToken}
              </p>
            )}
            {createdAt && (
              <p>
                Created by {creator} · {relativeTime(Number(createdAt))}
                <br />
                {new Date(Number(createdAt)).toLocaleString()}
              </p>
            )}
            {wasEdited && (
              <p>
                Last edited by {author} · {relativeTime(Number(updatedAt))}
                <br />
                {new Date(Number(updatedAt)).toLocaleString()}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>}
      {isCleaning && (
        <span
          contentEditable={false}
          className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-1.5 px-3.5"
        >
          <span className="ai-shimmer h-2.5 w-3/4 rounded-full" />
          <span className="ai-shimmer h-2.5 w-1/2 rounded-full" />
        </span>
      )}
      <NodeViewContent as="span" className={isCleaning ? 'invisible' : undefined} />
    </NodeViewWrapper>
  )
}
