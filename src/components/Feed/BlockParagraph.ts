import Paragraph from '@tiptap/extension-paragraph'

// Every top-level paragraph IS a block/entry. entryId is the stable link
// back to its `entry:<notebookId>:<entryId>` PouchDB doc — null means the
// block hasn't been assigned one yet (see AssignBlockId).
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
          attrs.authorColor
            ? { 'data-author-color': attrs.authorColor, style: `background-color: color-mix(in srgb, ${attrs.authorColor} 12%, white)` }
            : {},
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
    }
  },
})
