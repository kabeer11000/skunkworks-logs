import { verifyCouchLogin, getUserByApiToken, touchApiTokenLastUsed } from './couchdb-admin'

// Every /api/drains* route re-verifies the caller's own CouchDB password on
// each request (via the Authorization header their PouchDB sync already
// uses) rather than trusting a forwarded session — there's no first-party
// session cookie shared between this app's origin and CouchDB's (see the
// cross-origin note in couchdb-admin.ts's verifyCouchLogin).
//
// Also accepts `Authorization: Bearer <token>` — an account-level API
// token (couchdb-admin.ts's createApiToken/getUserByApiToken), meant for
// external agents/tools (the MCP server) rather than the browser client.
// Both paths resolve to the same { email } shape, so every existing route
// that already calls requireAuth becomes agent-usable with no route-level
// changes at all.
export interface AuthResult {
  email: string
  // Set only when authenticated via an API token — lets routes attribute
  // an agent-created entry to "via <tokenName>" instead of just the
  // person's normal identity (see EntryBlockView.tsx's agent badge).
  tokenName?: string
}

export async function requireAuth(request: Request): Promise<AuthResult | null> {
  const header = request.headers.get('authorization') || ''

  const bearerMatch = header.match(/^Bearer\s+(.+)$/i)
  if (bearerMatch) {
    const token = bearerMatch[1]
    const user = await getUserByApiToken(token)
    if (!user) return null
    touchApiTokenLastUsed(user.email, token) // best-effort, not awaited on the request's behalf
    return { email: user.email, tokenName: user.tokenName }
  }

  const basicMatch = header.match(/^Basic\s+(.+)$/i)
  if (!basicMatch) return null

  const decoded = Buffer.from(basicMatch[1], 'base64').toString('utf-8')
  const sep = decoded.indexOf(':')
  if (sep === -1) return null
  const email = decoded.slice(0, sep)
  const password = decoded.slice(sep + 1)

  const ok = await verifyCouchLogin(email, password)
  return ok ? { email } : null
}
