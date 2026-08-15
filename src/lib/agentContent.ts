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
const MENTION_RE = /@(?<email>[^\s@]+@[^\s@]+\.[^\s@]+)/
// [[dbName]] or [[dbName#entryId]] — this app has no existing plain-text
// form for a reference (the client's ReferenceExtension never renders one,
// display is resolved live from node attrs), so this is a new convention
// invented for agents/API callers to type by hand.
const REFERENCE_RE = /\[\[(?<refDb>[\w-]+)(?:#(?<refEntry>[\w-]+))?\]\]/
// Inline markdown, limited to the marks the Tiptap editor itself supports
// (bold/italic/strike/code — see EditorToolbar.tsx). No headings/lists:
// every entry is a single paragraph node by design (Feed/index.tsx), so
// block-level markdown has nowhere to go. Agents only ever send plaintext
// or markdown here, never HTML, so escaping everything outside these
// tokens is safe. ponytail: single-pass regex, not a real parser — no
// nested spans (bold containing a mention) and no escaping of literal
// */_/`/~ that isn't meant as markdown. Upgrade to a real markdown parser
// if that turns out to matter.
const CODE_RE = /`(?<code>[^`]+?)`/
const BOLD_RE = /\*\*(?<boldStar>[^*]+?)\*\*|__(?<boldUnderscore>[^_]+?)__/
const STRIKE_RE = /~~(?<strike>[^~]+?)~~/
const ITALIC_RE = /\*(?<italicStar>[^*]+?)\*|_(?<italicUnderscore>[^_]+?)_/
const COMBINED_RE = new RegExp(
  `${CODE_RE.source}|${BOLD_RE.source}|${STRIKE_RE.source}|${ITALIC_RE.source}|${MENTION_RE.source}|${REFERENCE_RE.source}`,
  'g'
)

// Converts an agent's plain-text/markdown entry or comment body into the
// same HTML shape the browser editor's marks and @mention/[[reference
// extensions produce — without this, an agent's "**bold**" or
// "@user@example.com" just saves as inert escaped text (literal asterisks)
// instead of real formatting. No existence/membership validation is done
// for mentions/references (matching ReferencePill's own "resolve access
// per-viewer at render time" design) — an invalid mention or reference
// just renders as a plain/locked pill, not an error.
export function renderAgentContent(text: string): string {
  let result = ''
  let lastIndex = 0

  for (const match of text.matchAll(COMBINED_RE)) {
    result += escapeHtml(text.slice(lastIndex, match.index))

    const { email, refDb, refEntry, code, boldStar, boldUnderscore, strike, italicStar, italicUnderscore } =
      match.groups!
    const bold = boldStar ?? boldUnderscore
    const italic = italicStar ?? italicUnderscore

    if (code !== undefined) {
      result += `<code>${escapeHtml(code)}</code>`
    } else if (bold !== undefined) {
      result += `<strong>${escapeHtml(bold)}</strong>`
    } else if (strike !== undefined) {
      result += `<s>${escapeHtml(strike)}</s>`
    } else if (italic !== undefined) {
      result += `<em>${escapeHtml(italic)}</em>`
    } else if (email) {
      const { text: color, background } = colorsForEmail(email)
      const safeEmail = escapeHtml(email)
      result += `<span class="mention-pill" data-type="mention" data-id="${safeEmail}" style="background:${background};color:${color}">@${safeEmail}</span>`
    } else if (refDb) {
      const safeDbName = escapeHtml(refDb)
      const refType = refEntry ? 'entry' : 'drain'
      const entryAttr = refEntry ? ` data-entry-id-ref="${escapeHtml(refEntry)}"` : ''
      result += `<span data-type="reference" class="reference-pill-src" data-ref-type="${refType}" data-db-name="${safeDbName}"${entryAttr}></span>`
    }

    lastIndex = match.index! + match[0].length
  }

  result += escapeHtml(text.slice(lastIndex))
  return result
}
