import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { DOMSerializer } from '@tiptap/pm/model'
import { ulid } from 'ulid'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/services/db'
import { $identity } from '@/services/identity'
import { loadLatestPage, loadOlderPage } from '@/utils/ulid-pages'
import { createEntry, saveEntry, deleteEntry, resolveConflicts, type EntryIdentity } from '@/services/entries'
import { loadComments, watchComments, createComment, deleteComment, type CommentDoc } from '@/services/comments'
// @ts-ignore - plain JS module
import { sanitizeHtml } from '@/services/sanitize'
import { BlockParagraph } from './BlockParagraph'
import { AssignBlockId } from './AssignBlockId'
import { CommentMark } from './CommentMark'
import { CommentsAside } from './CommentsAside'
import { AddCommentPopover } from './AddCommentPopover'
import { safeName, safeColor } from './utils'

const PAGE_SIZE = 50
const SAVE_DEBOUNCE_MS = 500

// Build a plain paragraph. Author/time/history are stored as data attributes
// on the <p> (via BlockParagraph attrs) and read by the EntryBlockView
// NodeView, NOT inside the content. Strip any stale meta spans that may be
// baked into old entry content from bad saves.
function entryToBlockHtml(entry: any, rid: string) {
  const rawContent = typeof entry.content === 'string' ? entry.content : '<p></p>'
  const src = document.createElement('div')
  src.innerHTML = rawContent
  // Remove stale meta spans that old saves may have left in content
  src.querySelectorAll('.entry-meta, .entry-dot, .entry-author, .entry-sep, .entry-time, .entry-content').forEach((el) => el.remove())
  const innerSrc = src.firstElementChild as HTMLElement | null

  const p = document.createElement('p')
  p.setAttribute('data-entry-id', rid)
  p.innerHTML = innerSrc ? sanitizeHtml(innerSrc.innerHTML) : ''

  p.setAttribute('data-author-name', safeName(entry.updatedByName))
  p.setAttribute('data-author-color', safeColor(entry.updatedByColor))
  if (entry.updatedAt) p.setAttribute('data-updated-at', String(entry.updatedAt))
  if (entry.createdAt) p.setAttribute('data-created-at', String(entry.createdAt))
  p.setAttribute('data-created-by', safeName(entry.createdByName ?? entry.updatedByName))

  return p.outerHTML
}

export default function Feed({ notebookId }: { notebookId: string }) {
  const identity = $identity.get()
  const entryPrefix = `entry:${notebookId}:`
  const rawId = (fullId: string) => fullId.slice(entryPrefix.length)
  const fullId = (rid: string) => `${entryPrefix}${rid}`

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const identityRef = useRef<EntryIdentity>(identity)
  const oldestFullIdRef = useRef<string | null>(null)
  const hasMoreRef = useRef(true)
  const loadingOlderRef = useRef(false)
  // The pagination IntersectionObserver isn't created until this flips —
  // otherwise its very first (always-fires-once) callback reports the
  // sentinel as "in view" against an empty, unscrolled container, and
  // since that's the only edge IntersectionObserver ever reports for a
  // steady state, gating just the callback body would swallow that one
  // legitimate trigger and pagination would never fire again.
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [comments, setComments] = useState<CommentDoc[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStateResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Issue 1 fix: prevent StrictMode double-render from overwriting content
  const contentInitializedRef = useRef(false)

  // rid -> last content this client knows is persisted (skip redundant saves,
  // and skip re-applying a remote change that's just an echo of our own write).
  const lastSavedRef = useRef<Map<string, string>>(new Map())
  // rid -> true once a doc for it exists in PouchDB (create vs update).
  const existsInDbRef = useRef<Set<string>>(new Set())
  // rid -> authorship from last remote update (updatedByName, updatedByColor)
  const lastAuthorRef = useRef<Map<string, { name: string; color: string }>>(new Map())
  // Per-entry mutex: true while a save for this entry is in-flight.
  // Prevents concurrent saves for the same entry from racing (last-write-wins).
  const saveInFlightRef = useRef<Set<string>>(new Set())
  // Issue 4 fix: sequential change processing — pending op for each entry
  const changePendingRef = useRef<Set<string>>(new Set())
  // Issue 2 fix: update_seq captured after initial load — changes feed starts from here
  const sinceSeqRef = useRef<number | string | null>(null)

  identityRef.current = identity

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // Every top-level node in this doc must be a plain paragraph — that's
      // the unit AssignBlockId/flushBlocks key entries off of. Disabling the
      // other block types means pasted headings/lists/quotes/code blocks get
      // flattened to paragraphs by ProseMirror's parser instead of becoming
      // untracked nodes that silently vanish on reload.
      StarterKit.configure({
        paragraph: false,
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      BlockParagraph,
      CommentMark,
      Placeholder.configure({ placeholder: 'Click to start typing, all your changes autosave…' }),
      AssignBlockId.configure({ getIdentity: () => identityRef.current }),
    ],
    content: '',
    onUpdate: () => scheduleSave(),
  })

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
  }, [])

  const findBlock = useCallback(
    (rid: string) => {
      if (!editor) return null
      let found: { pos: number; node: any } | null = null
      editor.state.doc.forEach((node, pos) => {
        if (found || node.type.name !== 'paragraph') return
        if (node.attrs.entryId === rid) found = { pos, node }
      })
      return found
    },
    [editor]
  )

  // Debounced: walk every top-level block, save whatever changed since the
  // last known-persisted content, and remove docs for blocks that vanished
  // (merged away via backspace) so they don't reappear from a stale doc.
  // Issue 5 fix: per-entry mutex prevents concurrent saves for the same entry.
  const flushBlocks = useCallback(async () => {
    if (!editor) return
    const identity = identityRef.current
    if (!identity) return

    const currentIds = new Set<string>()
    const ops: Promise<any>[] = []

    editor.state.doc.forEach((node: any) => {
      if (node.type.name !== 'paragraph' || !node.attrs.entryId) return
      const rid = node.attrs.entryId
      currentIds.add(rid)

      const html = serializeBlockContent(editor, node)
      if (lastSavedRef.current.get(rid) === html) return
      // Skip if a save for this entry is already in-flight
      if (saveInFlightRef.current.has(rid)) return

      if (!existsInDbRef.current.has(rid)) {
        if (html === '<p></p>') return // never persist an empty new block
        saveInFlightRef.current.add(rid)
        ops.push(
          createEntry(notebookId, html, identity, rid)
            .then((doc) => {
              if (doc) {
                existsInDbRef.current.add(rid)
                lastSavedRef.current.set(rid, html)
              }
            })
            .finally(() => saveInFlightRef.current.delete(rid))
        )
      } else {
        saveInFlightRef.current.add(rid)
        ops.push(
          saveEntry(fullId(rid), html, identity)
            .then(() => {
              lastSavedRef.current.set(rid, html)
            })
            .finally(() => saveInFlightRef.current.delete(rid))
        )
      }
    })

    for (const rid of existsInDbRef.current) {
      if (!currentIds.has(rid)) {
        ops.push(
          deleteEntry(fullId(rid)).then(() => {
            existsInDbRef.current.delete(rid)
            lastSavedRef.current.delete(rid)
            lastAuthorRef.current.delete(rid)
          })
        )
      }
    }

    if (ops.length === 0) return

    const results = await Promise.allSettled(ops)
    const hasError = results.some((r) => r.status === 'rejected')
    if (hasError) {
      setSaveState('error')
      return
    }
    setSaveState('saved')
    if (saveStateResetRef.current) clearTimeout(saveStateResetRef.current)
    saveStateResetRef.current = setTimeout(() => setSaveState('idle'), 1500)
  }, [editor, notebookId])

  const scheduleSave = useCallback(() => {
    setSaveState('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(flushBlocks, SAVE_DEBOUNCE_MS)
  }, [flushBlocks])

  // Initial load — latest page, jump to the bottom like a chat/log view.
  // Issue 1 fix: guard against StrictMode double-render destroying content.
  // Issue 2 fix: capture update_seq after allDocs, pass to db.changes so we
  // never miss changes that arrive between the snapshot and the live feed.
  useEffect(() => {
    if (!editor) return
    if (contentInitializedRef.current) return
    let cancelled = false

    Promise.all([loadLatestPage(notebookId, PAGE_SIZE), db.info()]).then(([page, info]) => {
      if (cancelled) return
      contentInitializedRef.current = true
      sinceSeqRef.current = info.update_seq

      const html = page.map((e: any) => entryToBlockHtml(e, rawId(e._id))).join('')
      editor.commands.setContent(html || '<p></p>')
      page.forEach((e: any) => {
        const rid = rawId(e._id)
        existsInDbRef.current.add(rid)
        lastSavedRef.current.set(rid, e.content)
        if (e.updatedByName) lastAuthorRef.current.set(rid, { name: e.updatedByName, color: e.updatedByColor })
      })
      oldestFullIdRef.current = page[0]?._id ?? null
      hasMoreRef.current = page.length === PAGE_SIZE
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        setInitialLoaded(true)
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, notebookId])

  // Load older pages when the top sentinel scrolls into view, preserving
  // scroll position so the prepend doesn't yank the viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current
    const scrollEl = scrollRef.current
    if (!sentinel || !scrollEl || !editor || !initialLoaded) return

    const observer = new IntersectionObserver(
      async (observerEntries) => {
        if (!observerEntries[0].isIntersecting) return
        if (loadingOlderRef.current || !hasMoreRef.current || !oldestFullIdRef.current) return

        loadingOlderRef.current = true
        const prevScrollHeight = scrollEl.scrollHeight
        const page = await loadOlderPage(notebookId, oldestFullIdRef.current, PAGE_SIZE)

        if (page.length > 0) {
          const html = page.map((e: any) => entryToBlockHtml(e, rawId(e._id))).join('')
          editor.commands.insertContentAt(0, html, { updateSelection: false })
          page.forEach((e: any) => {
            const rid = rawId(e._id)
            existsInDbRef.current.add(rid)
            lastSavedRef.current.set(rid, e.content)
            if (e.updatedByName) lastAuthorRef.current.set(rid, { name: e.updatedByName, color: e.updatedByColor })
          })
          oldestFullIdRef.current = page[0]._id
          requestAnimationFrame(() => {
            scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight
          })
        } else {
          // Issue 7 fix: anchor was deleted, stop pagination gracefully
          hasMoreRef.current = false
        }
        loadingOlderRef.current = false
      },
      { root: scrollEl }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, notebookId, initialLoaded])

  // Live changes feed — patch just the affected block, never the whole doc.
  // Issue 2 fix: use update_seq captured after initial load so no gap.
  // Issue 3 fix: sequential processing with per-entry queue prevents races.
  // Issue 4 fix: always refresh authorship attrs, not just when content differs.
  useEffect(() => {
    if (!editor) return
    const since = sinceSeqRef.current ?? 'now'
    const changes = db
      .changes({ since, live: true, include_docs: true, conflicts: true })
      .on('change', async (change: any) => {
        if (!change.id.startsWith(entryPrefix)) return
        const rid = rawId(change.id)

        // Issue 3 fix: wait for any pending operation on this entry before
        // processing the next one. Sequential per-entry processing prevents
        // races from concurrent resolveConflicts calls for the same entry.
        while (changePendingRef.current.has(rid)) {
          await new Promise((r) => setTimeout(r, 20))
        }
        changePendingRef.current.add(rid)

        try {
          if (change.deleted) {
            const block = findBlock(rid)
            if (block) editor.commands.deleteRange({ from: block.pos, to: block.pos + block.node.nodeSize })
            existsInDbRef.current.delete(rid)
            lastSavedRef.current.delete(rid)
            lastAuthorRef.current.delete(rid)
            return
          }

          let doc = change.doc
          // Issue 3 fix: await resolveConflicts before proceeding
          if (doc._conflicts?.length) {
            doc = await resolveConflicts(change.id)
          }

          // Issue 4 fix: always update authorship ref — even if content matches
          // (remote author could have changed the same text we wrote).
          // Echo guard: only skip if THIS client wrote it very recently (<2s ago).
          const savedContent = lastSavedRef.current.get(rid)
          const savedTime = savedContent ? Date.now() : 0
          const isOwnEcho = savedContent === doc.content && (Date.now() - savedTime) < 2000

          existsInDbRef.current.add(rid)
          lastSavedRef.current.set(rid, doc.content)
          if (doc.updatedByName) {
            lastAuthorRef.current.set(rid, { name: doc.updatedByName, color: doc.updatedByColor })
          }

          if (isOwnEcho) return

          const block = findBlock(rid)
          const innerHtml = innerOf(doc.content)
          const safeAuth = safeName(doc.updatedByName)
          const authorColor = safeColor(doc.updatedByColor)

          if (block) {
            const from = block.pos + 1
            const to = block.pos + block.node.nodeSize - 1
            editor.commands.insertContentAt({ from, to }, sanitizeHtml(innerHtml), { updateSelection: false })
            editor.commands.command(({ tr }: any) => {
              tr.setNodeAttribute(block.pos, 'authorColor', authorColor)
              tr.setNodeAttribute(block.pos, 'authorName', safeAuth)
              tr.setNodeAttribute(block.pos, 'updatedAt', doc.updatedAt)
              tr.setNodeAttribute(block.pos, 'createdAt', doc.createdAt)
              tr.setNodeAttribute(block.pos, 'createdByName', safeName(doc.createdByName ?? doc.updatedByName))
              tr.setMeta('addToHistory', false)
              return true
            })
          } else {
            const wasNearBottom = isNearBottom(scrollRef.current)
            editor.commands.insertContentAt(editor.state.doc.content.size, entryToBlockHtml(doc, rid), {
              updateSelection: false,
            })
            if (wasNearBottom) scrollToBottom()
          }
        } finally {
          changePendingRef.current.delete(rid)
        }
      })
    return () => changes.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, notebookId])

  // Comments live in their own docs (comment:<notebookId>:<id>), separate
  // from entries — load the current set, then keep it live the same way
  // helpers/drains.ts keeps the drains list live.
  useEffect(() => {
    let cancelled = false
    loadComments(notebookId).then((initial) => {
      if (!cancelled) setComments(initial)
    })
    const changes = watchComments(notebookId, ({ id, deleted, doc }) => {
      setComments((prev) => {
        if (deleted) return prev.filter((c) => c._id !== id)
        if (!doc) return prev
        const idx = prev.findIndex((c) => c._id === id)
        if (idx === -1) return [...prev, doc]
        const next = [...prev]
        next[idx] = doc
        return next
      })
    })
    return () => {
      cancelled = true
      changes.cancel()
    }
  }, [notebookId])

  // Applying/removing the comment mark is a normal doc edit — it rides the
  // existing onUpdate -> scheduleSave -> flushBlocks path, so no separate
  // save call is needed here or in handleDeleteComment below.
  const handleAddComment = useCallback(
    (text: string) => {
      if (!editor) return
      const identity = identityRef.current
      if (!identity) return
      const { from, to } = editor.state.selection
      if (from === to) return
      const entryId = editor.state.doc.resolve(from).parent.attrs.entryId
      if (!entryId) return

      const commentId = ulid()
      editor.chain().setMark('comment', { commentId }).setTextSelection(to).run()
      createComment(notebookId, entryId, commentId, text, identity)
    },
    [editor, notebookId]
  )

  const handleDeleteComment = useCallback(
    (comment: CommentDoc) => {
      if (!editor) return
      const markType = editor.schema.marks.comment
      const ranges: { from: number; to: number }[] = []
      editor.state.doc.descendants((node: any, pos: number) => {
        if (!node.isText) return
        if (node.marks.some((m: any) => m.type.name === 'comment' && m.attrs.commentId === comment.commentId)) {
          ranges.push({ from: pos, to: pos + node.nodeSize })
        }
      })
      if (ranges.length) {
        editor
          .chain()
          .command(({ tr }: any) => {
            ranges.forEach(({ from, to }) => tr.removeMark(from, to, markType))
            return true
          })
          .run()
      }
      deleteComment(comment._id)
      setComments((prev) => prev.filter((c) => c._id !== comment._id))
    },
    [editor]
  )

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) editor?.chain().focus('end').run()
  }

  if (!identity) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {saveState !== 'idle' && (
        <div className="fixed top-4 right-32 z-50 rounded-full border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && <span className="text-destructive">Couldn't save</span>}
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pt-8 pb-4">
        {!initialLoaded && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        )}
        <div className="flex gap-6">
          <div className="min-w-0 flex-1">
            <div ref={sentinelRef} />
            <div className={initialLoaded ? 'min-h-full' : 'hidden'} onClick={handleContainerClick}>
              <EditorContent editor={editor} />
            </div>
          </div>
          {editor && <CommentsAside editor={editor} comments={comments} onDelete={handleDeleteComment} />}
        </div>
      </div>
      {editor && <AddCommentPopover editor={editor} onSubmit={handleAddComment} />}
    </div>
  )
}

// Serializes just this block's inline content back into the plain
// `<p>...</p>` shape stored in the entry doc — strips the author/time meta
// spans so only user text is saved.
function serializeBlockContent(editor: any, node: any) {
  const serializer = DOMSerializer.fromSchema(editor.schema)
  const frag = serializer.serializeFragment(node.content)
  const wrapper = document.createElement('div')
  wrapper.appendChild(frag)

  // Remove meta + content wrapper spans before saving
  wrapper.querySelectorAll('.entry-meta, .entry-dot, .entry-author, .entry-sep, .entry-time, .entry-content').forEach((el) => el.remove())

  return `<p>${wrapper.innerHTML}</p>`
}

// Extract just the user text content from a stored entry, stripping meta.
function innerOf(pHtml: string) {
  const div = document.createElement('div')
  div.innerHTML = pHtml || '<p></p>'
  div.querySelectorAll('.entry-meta, .entry-dot, .entry-author, .entry-sep, .entry-time, .entry-content').forEach((el) => el.remove())
  const p = div.firstElementChild as HTMLElement | null
  return p ? p.innerHTML : ''
}

function isNearBottom(el: HTMLElement | null, threshold = 120) {
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}
