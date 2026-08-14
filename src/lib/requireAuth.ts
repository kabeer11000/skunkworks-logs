import { verifyCouchLogin } from './couchdb-admin'

// Every /api/drains* route re-verifies the caller's own CouchDB password on
// each request (via the Authorization header their PouchDB sync already
// uses) rather than trusting a forwarded session — there's no first-party
// session cookie shared between this app's origin and CouchDB's (see the
// cross-origin note in couchdb-admin.ts's verifyCouchLogin).
export async function requireAuth(request: Request): Promise<{ email: string } | null> {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Basic\s+(.+)$/i)
  if (!match) return null

  const decoded = Buffer.from(match[1], 'base64').toString('utf-8')
  const sep = decoded.indexOf(':')
  if (sep === -1) return null
  const email = decoded.slice(0, sep)
  const password = decoded.slice(sep + 1)

  const ok = await verifyCouchLogin(email, password)
  return ok ? { email } : null
}
