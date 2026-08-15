import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'

// Marks every entry an AI summary claims (summarizedEntryIds) with a
// derived claimedBySummary attr. Re-summarizing the same day without
// deleting the old summary first stacks a second summary node directly
// above the same claimed entries — rather than treating that as a second,
// separately-badged card (which looked janky: bigger gap between the two
// summaries than between claimed entries, second badge overlapping the
// first card), a summary node whose immediately-preceding sibling is
// ALSO a summary is treated exactly like a claimed entry for chain
// purposes (isNestedSummary) — same tight margin, same continuous bar,
// no badge of its own. Only the topmost ("root") summary in a stack shows
// the badge; isLastInGroup marks whichever node (claimed entry OR nested
// summary) is the true end of the whole chain. Recomputed from scratch on
// every doc-changing transaction — deleting a summary means the next scan
// simply finds one fewer link in the chain, no cleanup logic needed.
export const SummaryGrouping = Extension.create({
  name: 'summaryGrouping',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('summaryGrouping'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null

          const claimed = new Set<string>()
          newState.doc.forEach((node) => {
            if (node.type.name === 'paragraph' && node.attrs.source === 'ai-summary' && node.attrs.summarizedEntryIds) {
              for (const id of node.attrs.summarizedEntryIds) claimed.add(id)
            }
          })

          // Collected as a plain array first, then walked with a normal
          // index-based loop (not nested closures) — TypeScript loses
          // narrowing on a `let` reassigned inside a forEach callback, same
          // class of issue already hit elsewhere in this codebase
          // (EditorToolbar.tsx's currentBlock).
          const paragraphs: { pos: number; isSummary: boolean; inChain: boolean }[] = []
          newState.doc.forEach((node, pos) => {
            if (node.type.name !== 'paragraph') return
            const isSummary = node.attrs.source === 'ai-summary'
            const inChain = isSummary || claimed.has(node.attrs.entryId)
            paragraphs.push({ pos, isSummary, inChain })
          })

          const changes: {
            pos: number
            shouldClaim: boolean
            isNestedSummary: boolean
            isLastInGroup: boolean
          }[] = []
          for (let i = 0; i < paragraphs.length; i++) {
            const { pos, isSummary, inChain } = paragraphs[i]
            const shouldClaim = inChain && !isSummary
            const isNestedSummary = isSummary && (paragraphs[i - 1]?.isSummary ?? false)
            const isLastInGroup = inChain && !(paragraphs[i + 1]?.inChain ?? false)
            const node = newState.doc.nodeAt(pos)
            if (!node) continue
            if (
              !!node.attrs.claimedBySummary !== shouldClaim ||
              !!node.attrs.isNestedSummary !== isNestedSummary ||
              !!node.attrs.isLastInGroup !== isLastInGroup
            ) {
              changes.push({ pos, shouldClaim, isNestedSummary, isLastInGroup })
            }
          }
          if (changes.length === 0) return null

          const tr: Transaction = newState.tr
          for (const { pos, shouldClaim, isNestedSummary, isLastInGroup } of changes) {
            tr.setNodeAttribute(pos, 'claimedBySummary', shouldClaim)
            tr.setNodeAttribute(pos, 'isNestedSummary', isNestedSummary)
            tr.setNodeAttribute(pos, 'isLastInGroup', isLastInGroup)
          }
          tr.setMeta('addToHistory', false)
          return tr
        },
      }),
    ]
  },
})
