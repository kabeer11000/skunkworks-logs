import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ulid } from 'ulid'

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
            tr.setNodeAttribute(pos, 'entryId', ulid())
            tr.setNodeAttribute(pos, 'authorColor', identity.color)
            tr.setNodeAttribute(pos, 'authorName', identity.name)
            tr.setNodeAttribute(pos, 'updatedAt', null)
          })

          if (tr) tr.setMeta('addToHistory', false)
          return tr
        },
      }),
    ]
  },
})
