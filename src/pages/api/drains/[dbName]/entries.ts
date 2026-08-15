import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { getDirectoryDrains, getEntriesPage, createUserEntry } from '@/lib/couchdb-admin'
import { deriveIdentity } from '@/services/identity'
import { escapeHtml } from '@/lib/htmlEscape'

export const prerender = false

async function requireMember(request: Request, dbName: string) {
  const caller = await requireAuth(request)
  if (!caller) return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) }
  const drains = await getDirectoryDrains(caller.email)
  if (!drains.some((d) => d.dbName === dbName)) {
    return { error: new Response(JSON.stringify({ error: 'Not a member of this drain' }), { status: 403 }) }
  }
  return { caller }
}

// GET ?limit=&before= — before is a raw ulid (no "entry:" prefix), same
// convention entryId node attrs already use elsewhere in this app.
export const GET: APIRoute = async ({ request, params, url }) => {
  const dbName = params.dbName!
  const { error } = await requireMember(request, dbName)
  if (error) return error

  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)
  const before = url.searchParams.get('before') || undefined
  const entries = await getEntriesPage(dbName, limit, before)

  return new Response(JSON.stringify({ entries }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export const POST: APIRoute = async ({ request, params }) => {
  const dbName = params.dbName!
  const { error, caller } = await requireMember(request, dbName)
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return new Response(JSON.stringify({ error: 'content is required' }), { status: 400 })

  const identity = await deriveIdentity(caller!.email, caller!.email.split('@')[0])
  const doc = await createUserEntry(dbName, `<p>${escapeHtml(content)}</p>`, { ...identity }, caller!.tokenName ?? 'API')

  return new Response(JSON.stringify({ entry: doc }), { status: 201, headers: { 'Content-Type': 'application/json' } })
}
