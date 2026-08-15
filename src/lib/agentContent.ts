import { escapeHtml } from './htmlEscape'

// Same deterministic-hue derivation as MentionExtension.ts's colorsForEmail
// — kept in sync manually since one lives in a Tiptap extension (client)
// and this one runs server-side for agent-submitted plain text. Returns a
// separate alpha'd background — hsl() needs its own alpha argument, string-
// concatenating a hex-alpha suffix onto it doesn't work (confirmed by
// testing the resulting CSS wasn't actually being applied).
function colorsForEmail(email: string) {
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return { text: `hsl(${hue}, 35%, 45%)`, background: `hsl(${hue}, 35%, 45%, 0.13)` }
}

// @user@example.com — same syntax the client's own mention pill renders as
// (see MentionExtension.ts), so a mention typed by a human and one typed
// by an agent look identical once saved.
const MENTION_RE = /@([^\s@]+@[^\s@]+\.[^\s@]+)/g
// [[dbName]] or [[dbName#entryId]] — this app has no existing plain-text
// form for a reference (the client's ReferenceExtension never renders one,
// display is resolved live from node attrs), so this is a new convention
// invented for agents/API callers to type by hand.
const REFERENCE_RE = /\[\[([\w-]+)(?:#([\w-]+))?\]\]/g
const COMBINED_RE = new RegExp(`(?:${MENTION_RE.source})|(?:${REFERENCE_RE.source})`, 'g')

// Converts an agent's plain-text entry/comment body into the same HTML
// shape the browser editor's @mention and [[reference extensions produce —
// without this, an agent's "@user@example.com" or "[[dbName]]" just saves
// as inert escaped text instead of a real, clickable pill. No existence/
// membership validation is done here (matching ReferencePill's own
// "resolve access per-viewer at render time" design) — an invalid mention
// or reference just renders as a plain/locked pill, not an error.
export function renderAgentContent(text: string): string {
  let result = ''
  let lastIndex = 0

  for (const match of text.matchAll(COMBINED_RE)) {
    result += escapeHtml(text.slice(lastIndex, match.index))

    const [, email, dbName, entryId] = match
    if (email) {
      const { text: color, background } = colorsForEmail(email)
      const safeEmail = escapeHtml(email)
      result += `<span class="mention-pill" data-type="mention" data-id="${safeEmail}" style="background:${background};color:${color}">@${safeEmail}</span>`
    } else if (dbName) {
      const safeDbName = escapeHtml(dbName)
      const refType = entryId ? 'entry' : 'drain'
      const entryAttr = entryId ? ` data-entry-id-ref="${escapeHtml(entryId)}"` : ''
      result += `<span data-type="reference" class="reference-pill-src" data-ref-type="${refType}" data-db-name="${safeDbName}"${entryAttr}></span>`
    }

    lastIndex = match.index! + match[0].length
  }

  result += escapeHtml(text.slice(lastIndex))
  return result
}
