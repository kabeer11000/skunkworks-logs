import Paragraph from '@tiptap/extension-paragraph'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { EntryBlockView } from './EntryBlockView'

// Every top-level paragraph IS a block/entry. entryId is the stable link
// back to its `entry:<entryId>` PouchDB doc (in this drain's own database)
// — null means the block hasn't been assigned one yet (see AssignBlockId).
//
// Rendered via a React NodeView (EntryBlockView) so the entry can host a
// real shadcn Popover for author/history details — once a NodeView is
// registered, ProseMirror no longer uses renderHTML to build the live DOM,
// only parseHTML (reading these attrs back out of stored/pasted HTML).
export const BlockParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      entryId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-entry-id'),
        renderHTML: (attrs: any) => (attrs.entryId ? { 'data-entry-id': attrs.entryId } : {}),
      },
      authorColor: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-author-color'),
        renderHTML: (attrs: any) =>
          attrs.authorColor ? { 'data-author-color': attrs.authorColor } : {},
      },
      authorName: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-author-name'),
        renderHTML: (attrs: any) =>
          attrs.authorName ? { 'data-author-name': attrs.authorName } : {},
      },
      updatedAt: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-updated-at'),
        renderHTML: (attrs: any) =>
          attrs.updatedAt ? { 'data-updated-at': attrs.updatedAt } : {},
      },
      createdAt: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-created-at'),
        renderHTML: (attrs: any) =>
          attrs.createdAt ? { 'data-created-at': attrs.createdAt } : {},
      },
      createdByName: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-created-by'),
        renderHTML: (attrs: any) =>
          attrs.createdByName ? { 'data-created-by': attrs.createdByName } : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntryBlockView)
  },
})
