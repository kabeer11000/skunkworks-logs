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
      // Set only for entries created by an integration (e.g. GitHub webhook
      // ingestion, see api/ingest/[token].ts) — distinguishes bot-authored
      // entries from ones a person typed, so EntryBlockView can render a
      // different badge instead of the usual colored-dot author indicator.
      source: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-source'),
        renderHTML: (attrs: any) => (attrs.source ? { 'data-source': attrs.source } : {}),
      },
      // Explicitly managed by ensureLeadingComposer in Feed/index.tsx —
      // distinguishes "the one pinned composer slot at the top" from any
      // other paragraph that happens to be empty (e.g. a real entry edited
      // down to nothing), which should render as a plain blank entry, not
      // the composer's dashed-border placeholder look.
      isComposer: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
      // Purely transient UI state toggled by EditorToolbar's cleanup button
      // while a MiniMax request is in flight for this block — never parsed
      // from or rendered into stored HTML, so there's no risk of it leaking
      // into saved content (serializeBlockContent only serializes a node's
      // inline content, not its attrs, but keeping this one out of
      // parseHTML/renderHTML entirely means it can never even round-trip).
      cleaning: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntryBlockView)
  },

  // Plain Enter always jumps back to the composer slot at the top
  // (Slack-message-box style) — newest-first order means "continue below"
  // doesn't make sense as the default. Detecting "am I currently in the
  // composer" to decide this conditionally doesn't work: ensureLeadingComposer
  // (Feed/index.tsx) moves the isComposer flag away the moment you type the
  // first character, so by the time Enter is pressed you're never actually
  // in the flagged node anymore. Mod-Shift-Enter is the explicit escape
  // hatch for the other case — splitting an older, already-positioned entry
  // into two in place. AssignBlockId's duplicate-id handling gives the
  // split-off half an id sorted right below the original's (idBefore)
  // instead of "now", so newest-first reload order matches what splitting
  // in place looked like.
  addKeyboardShortcuts() {
    return {
      // A @mention or [[reference popup is open — let its own Enter
      // handling (select the highlighted item) run instead of jumping to
      // the composer. Extension registration order makes this plugin's
      // keymap run before the suggestion plugins' handleKeyDown, so without
      // this check Enter would always jump to composer instead of ever
      // reaching the popup, confirmed directly (see MentionExtension.ts /
      // ReferenceExtension.ts, whose popups both set data-suggestion-popup).
      Enter: () => {
        if (document.querySelector('[data-suggestion-popup]')) return false
        this.editor.commands.focus(1)
        return true
      },
      'Mod-Shift-Enter': () => this.editor.commands.splitBlock(),
    }
  },
})
