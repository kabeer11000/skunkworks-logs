import { Marked } from 'marked'
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
  return {
    text: `light-dark(hsl(${hue}, 35%, 45%), hsl(${hue}, 55%, 75%))`,
    background: `light-dark(hsl(${hue}, 35%, 45%, 0.13), hsl(${hue}, 45%, 65%, 0.2))`,
  }
}

// @user@example.com — same syntax the client's own mention pill renders as
// (see MentionExtension.ts), so a mention typed by a human and one typed
// by an agent look identical once saved.
const MENTION_RE = /@(?<email>[^\s@]+@[^\s@]+\.[^\s@]+)/g
// [[dbName]] or [[dbName#entryId]] — this app has no existing plain-text
// form for a reference (the client's ReferenceExtension never renders one,
// display is resolved live from node attrs), so this is a new convention
// invented for agents/API callers to type by hand.
const REFERENCE_RE = /\[\[(?<refDb>[\w-]+)(?:#(?<refEntry>[\w-]+))?\]\]/g
const TOKEN_RE = new RegExp(`${MENTION_RE.source}|${REFERENCE_RE.source}`, 'g')

// Markers wrapping mention/reference pills while markdown runs underneath,
// swapped back out for the real pill HTML afterward. \x02/\x03 (STX/ETX)
// rather than bare digits — a plain number would collide with any real
// digits already in the agent's text (e.g. "version 2") during swap-back.
const PLACEHOLDER_RE = /\x02(\d+)\x03/g

// This app's only entry point for un-sanitized, server-stored HTML — this
// runs for API/MCP-submitted entries and comments, which skip the browser
// editor's DOMPurify pass entirely (see couchdb-admin.ts createUserEntry /
// updateUserEntryAsAuthor: content is stored as-is, no sanitizeHtml call).
// So every override below is a security boundary, not a style choice:
//   - html: marked's default behavior is to pass raw inline HTML straight
//     through (that's spec-compliant CommonMark) — left alone, an agent
//     typing "<img src=x onerror=...>" would be stored and rendered live.
//   - link / image: not part of what was asked (bold/italic/strike/code —
//     the marks the editor's own toolbar supports) and not sanitized for
//     dangerous schemes (marked doesn't block javascript: hrefs since v5
//     dropped its built-in sanitizer) — safest is to not parse them into
//     anchors/images at all and leave the markdown source as literal text.
//   - del: marked's GFM strikethrough renders <del>; the editor's Strike
//     mark and this app's sanitizeHtml allow-list both use <s>.
const marked = new Marked({ gfm: true })
marked.use({
  renderer: {
    html(token) {
      return escapeHtml(token.text)
    },
    del(token) {
      return `<s>${this.parser.parseInline(token.tokens)}</s>`
    },
    link(token) {
      return escapeHtml(token.raw)
    },
    image(token) {
      return escapeHtml(token.raw)
    },
  },
})

// Converts an agent's plain-text/markdown entry or comment body into the
// same HTML shape the browser editor's marks and @mention/[[reference
// extensions produce — without this, an agent's "**bold**" or
// "@user@example.com" just saves as inert escaped text (literal asterisks)
// instead of real formatting. No existence/membership validation is done
// for mentions/references (matching ReferencePill's own "resolve access
// per-viewer at render time" design) — an invalid mention or reference
// just renders as a plain/locked pill, not an error.
//
// Only inline markdown is supported (bold/italic/strike/code, matching
// EditorToolbar.tsx) — every entry is a single paragraph node by design
// (Feed/index.tsx disables StarterKit's block types), so headings/lists
// have nowhere to go; marked.parseInline never produces them anyway.
export function renderAgentContent(text: string): string {
  const pills: string[] = []
  const withPlaceholders = text.replace(TOKEN_RE, (_match, email, refDb, refEntry) => {
    let html: string
    if (email) {
      const { text: color, background } = colorsForEmail(email)
      const safeEmail = escapeHtml(email)
      html = `<span class="mention-pill" data-type="mention" data-id="${safeEmail}" style="background:${background};color:${color}">@${safeEmail}</span>`
    } else {
      const safeDbName = escapeHtml(refDb)
      const refType = refEntry ? 'entry' : 'drain'
      const entryAttr = refEntry ? ` data-entry-id-ref="${escapeHtml(refEntry)}"` : ''
      html = `<span data-type="reference" class="reference-pill-src" data-ref-type="${refType}" data-db-name="${safeDbName}"${entryAttr}></span>`
    }
    pills.push(html)
    return `\x02${pills.length - 1}\x03`
  })

  const parsed = marked.parseInline(withPlaceholders, { async: false }) as string
  return parsed.replace(PLACEHOLDER_RE, (_match, index) => pills[Number(index)])
}
