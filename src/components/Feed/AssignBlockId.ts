import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { monotonicFactory } from 'ulid'
import { idBefore } from '@/utils/ulidArithmetic'

// Plain ulid() only sorts correctly across different milliseconds — pasting
// N lines assigns N ids inside one synchronous pass, all in the same
// millisecond, so plain ulid() can hand out ids in a different order than
// the lines appear in. Entries reload sorted by id, so that reshuffles them.
// monotonicFactory keeps ids strictly increasing even within the same ms.
const ulid = monotonicFactory()

// Splitting an existing (already-saved) entry via Enter should keep both
// halves sorted right next to each other, not send the new half to "now" —
// under newest-first display, a fresh timestamp would fly it to the very
// top on reload even though it visually stayed put mid-edit. The split-off
// half always lands BELOW the original in the document (it's whatever came
// after the cursor), and under descending/newest-first order a lower
// on-screen position needs a SMALLER id, not a larger one (see idBefore in
// utils/ulidArithmetic.ts), with room for a few simultaneous duplicates
// (rare, but possible) to each get a distinct, still-adjacent id.

export interface BlockIdentity {
  publicUserId: string
  name: string
  color: string
}

// Every top-level paragraph must have an entryId to be linkable to a
// PouchDB doc. Splitting a block (Enter) produces a new paragraph with no
// entryId — this plugin notices on the very next transaction and assigns
// one, tagged with whoever is currently typing.
export const AssignBlockId = Extension.create<{ getIdentity: () => BlockIdentity }>({
  name: 'assignBlockId',

  addOptions() {
    return { getIdentity: () => ({ publicUserId: '', name: '', color: '' }) }
  },

  addProseMirrorPlugins() {
    const getIdentity = this.options.getIdentity
    return [
      new Plugin({
        key: new PluginKey('assignBlockId'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null

          let tr: ReturnType<typeof newState.tr> | null = null
          const identity = getIdentity()
          const seen = new Set<string>()
          const duplicateCount = new Map<string, number>()

          // Splitting a block (Enter) copies the original node's attrs onto
          // the new node, so a duplicate entryId — not just a missing one —
          // means "this is actually a new block": keep the first occurrence
          // (the content before the cursor), reassign every later duplicate.
          newState.doc.forEach((node, pos) => {
            if (node.type.name !== 'paragraph') return
            const id = node.attrs.entryId
            if (id && !seen.has(id)) {
              seen.add(id)
              return
            }
            tr = tr || newState.tr
            // A duplicate (id truthy but already seen) is a split of an
            // existing entry — sort it right below the original instead of
            // "now". A genuinely null id (e.g. the composer's fresh empty
            // paragraph inserted by ensureLeadingComposer) has no original
            // to sort next to, so it gets a real fresh timestamp.
            let newId: string
            if (id) {
              const bump = (duplicateCount.get(id) ?? 0) + 1
              duplicateCount.set(id, bump)
              newId = idBefore(id, bump)
            } else {
              newId = ulid()
            }
            tr.setNodeAttribute(pos, 'entryId', newId)
            tr.setNodeAttribute(pos, 'authorColor', identity.color)
            tr.setNodeAttribute(pos, 'authorName', identity.name)
            tr.setNodeAttribute(pos, 'updatedAt', null)
            tr.setNodeAttribute(pos, 'createdAt', Date.now())
            tr.setNodeAttribute(pos, 'createdByName', identity.name)
          })

          if (tr) tr.setMeta('addToHistory', false)
          return tr
        },
      }),
    ]
  },
})
