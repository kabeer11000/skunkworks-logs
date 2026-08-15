import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { getDirectoryDrains, updateUserEntryAsAuthor, deleteUserEntryAsAuthor, stripEntryPrefix } from '@/lib/couchdb-admin'
import { escapeHtml } from '@/lib/htmlEscape'
import { deriveIdentity } from '@/services/identity'

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

// Both routes enforce author-only edit/delete in app code — writes go
// through the admin credential, which bypasses validate_doc_update's own
// version of this same rule (it explicitly exempts _admin), so without
// this check an API token would end up more powerful than a real signed-in
// user, not at parity with one.
export const PATCH: APIRoute = async ({ request, params }) => {
  const dbName = params.dbName!
  const entryId = params.entryId!
  const { error, caller } = await requireMember(request, dbName)
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return new Response(JSON.stringify({ error: 'content is required' }), { status: 400 })

  try {
    const identity = await deriveIdentity(caller!.email, caller!.email.split('@')[0])
    const doc = await updateUserEntryAsAuthor(dbName, entryId, `<p>${escapeHtml(content)}</p>`, identity)
    return new Response(
      JSON.stringify({ entry: stripEntryPrefix(doc) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return new Response(JSON.stringify({ error: 'Entry not found' }), { status: 404 })
    if (err.message === 'FORBIDDEN') {
      return new Response(JSON.stringify({ error: 'Only the entry\'s original author can edit it' }), { status: 403 })
    }
    throw err
  }
}

export const DELETE: APIRoute = async ({ request, params }) => {
  const dbName = params.dbName!
  const entryId = params.entryId!
  const { error, caller } = await requireMember(request, dbName)
  if (error) return error

  try {
    await deleteUserEntryAsAuthor(dbName, entryId, caller!.email)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return new Response(JSON.stringify({ error: 'Entry not found' }), { status: 404 })
    if (err.message === 'FORBIDDEN') {
      return new Response(JSON.stringify({ error: 'Only the entry\'s original author can delete it' }), { status: 403 })
    }
    throw err
  }
}
