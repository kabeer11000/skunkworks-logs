// entry/auto-author.ts
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

// Keystrokes from the same author within this window reuse the same
// mark attrs, so ProseMirror merges them into one continuous span
// instead of creating a new node per character.
const SESSION_GAP_MS = 4000

export const AutoAuthorExtension = Extension.create({
  name: 'autoAuthor',

  addOptions() {
    return {
      authorName: 'Unknown',
      authorColor: '#91b5fc',
    }
  },

  addStorage() {
    return {
      // Set true by the host component while it's programmatically loading
      // or syncing content, so that content is never re-attributed to the
      // local user.
      suspended: false,
      sessionTimestamp: null as string | null,
      sessionLastEditAt: 0,
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('autoAuthorPlugin'),
        appendTransaction: (transactions, oldState, newState) => {
          if (this.storage.suspended) return null

          const docChanged = transactions.some((tr) => tr.docChanged)
          if (!docChanged) return null

          if (transactions.some((tr) => tr.getMeta('history$'))) return null

          const relevant = transactions.filter((tr) => !tr.getMeta('autoAuthorPlugin'))
          if (relevant.length === 0) return null

          let tr = newState.tr
          let modified = false
          const markType = newState.schema.marks.entryMark

          // One timestamp for the whole batch, reused across the session
          // window, instead of `new Date()` per node/keystroke.
          const now = Date.now()
          if (
            !this.storage.sessionTimestamp ||
            now - this.storage.sessionLastEditAt > SESSION_GAP_MS
          ) {
            this.storage.sessionTimestamp = new Date(now).toISOString()
          }
          this.storage.sessionLastEditAt = now
          const markTimestamp = this.storage.sessionTimestamp

          relevant.forEach((transaction) => {
            transaction.steps.forEach((step) => {
              step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
                if (newEnd <= newStart) return
                newState.doc.nodesBetween(newStart, newEnd, (node, pos) => {
                  if (!node.isText) return

                  const hasMyMark = node.marks.some(
                    (m) =>
                      m.type.name === 'entryMark' &&
                      m.attrs['data-author'] === this.options.authorName
                  )
                  if (hasMyMark) return

                  const mark = markType.create({
                    'data-author': this.options.authorName,
                    'data-color': this.options.authorColor,
                    'data-updated-at': markTimestamp,
                  })
                  tr.addMark(pos, pos + node.nodeSize, mark)
                  modified = true
                })
              })
            })
          })

          if (modified) {
            tr.setMeta('autoAuthorPlugin', true)
            tr.setMeta('addToHistory', false)
            return tr
          }

          return null
        },
      }),
    ]
  },
})