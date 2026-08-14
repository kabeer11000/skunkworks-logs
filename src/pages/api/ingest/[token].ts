import type { APIRoute } from 'astro'
import { getDrainByIngestionToken, createIngestedEntry, recordIngestionEvent } from '@/lib/couchdb-admin'

export const prerender = false

// Commit messages/PR titles are attacker-controllable text from GitHub —
// services/sanitize.js's DOMPurify-based sanitizer needs a browser `window`
// (no jsdom installed here), so it can't run in this server route. The HTML
// skeleton itself is fixed and only these plain-text fields get
// interpolated into it, so escaping them is sufficient — this isn't
// sanitizing arbitrary rich HTML, just neutralizing text going into
// attribute/text positions in HTML this handler otherwise fully controls.
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Only allow http(s) URLs through into href attributes — GitHub always
// sends real https:// URLs, but there's no reason to trust that blindly
// for something that ends up as a clickable link (e.g. a javascript: URL).
function safeUrl(url: unknown): string {
  if (typeof url !== 'string') return '#'
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '#'
  } catch {
    return '#'
  }
}

// No auth — the unguessable token in the URL itself is the credential,
// same security posture as a Slack/Zapier incoming webhook URL. GitHub also
// supports HMAC-signed payloads (X-Hub-Signature-256) via a webhook secret,
// which would add a second layer, but that needs its own secret configured
// on both sides — skipped for v1, the token is enough to ship this.
export const POST: APIRoute = async ({ request, params }) => {
  const token = params.token!
  const resolved = await getDrainByIngestionToken(token)
  if (!resolved) return new Response(JSON.stringify({ error: 'Unknown ingestion token' }), { status: 404 })

  const event = request.headers.get('x-github-event')
  const body = await request.json().catch(() => null)
  if (!body) return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })

  // GitHub sends this once when the webhook is first created, purely to
  // confirm delivery — no entry to log yet.
  if (event === 'ping') {
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  const lines: string[] = []
  const repo = escapeHtml(body.repository?.full_name ?? 'repo')

  if (event === 'push' && Array.isArray(body.commits)) {
    for (const commit of body.commits) {
      const message = escapeHtml(String(commit.message || '').split('\n')[0])
      const sha = escapeHtml(String(commit.id || '').slice(0, 7))
      lines.push(
        `<p>Pushed to <strong>${repo}</strong>: ${message} — <a href="${safeUrl(commit.url)}">${sha}</a></p>`
      )
    }
  } else if (event === 'pull_request') {
    const pr = body.pull_request
    if (pr) {
      const verb = body.action === 'closed' ? (pr.merged ? 'Merged' : 'Closed') : 'Opened'
      const title = escapeHtml(pr.title ?? '')
      lines.push(
        `<p>${verb} PR <a href="${safeUrl(pr.html_url)}">#${Number(pr.number) || 0}</a> in <strong>${repo}</strong>: ${title}</p>`
      )
    }
  }

  if (lines.length === 0) {
    // Recognized-but-unhandled event types (or an event we don't parse
    // yet) still 200 — GitHub retries on non-2xx, and there's nothing
    // wrong with the delivery itself.
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
  }

  const now = Date.now()
  for (const html of lines) {
    await createIngestedEntry(resolved.dbName, html, now)
  }
  await recordIngestionEvent(resolved.dbName)

  return new Response(JSON.stringify({ ok: true, created: lines.length }), { status: 200 })
}
