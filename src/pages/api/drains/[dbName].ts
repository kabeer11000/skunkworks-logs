import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import {
  getDirectoryDrains,
  trashDrain,
  putAdminDoc,
  getAdminDoc,
  updateDirectoryMetaForAllMembers,
} from '@/lib/couchdb-admin'

export const prerender = false

// Soft-delete, not a real destroy — see couchdb-admin.ts's trashDrain.
// The actual permanent-delete path is POST /api/drains/:dbName/purge, a
// separate, more clearly-dangerous action, not this one.
export const DELETE: APIRoute = async ({ request, params }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  const dbName = params.dbName!

  const drains = await getDirectoryDrains(caller.email)
  const mine = drains.find((d) => d.dbName === dbName)
  if (!mine || mine.role !== 'owner') {
    return new Response(JSON.stringify({ error: 'Only the owner can delete this drain' }), { status: 403 })
  }

  await trashDrain(dbName)

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export const PATCH: APIRoute = async ({ request, params }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  const dbName = params.dbName!

  const drains = await getDirectoryDrains(caller.email)
  if (!drains.some((d) => d.dbName === dbName)) {
    return new Response(JSON.stringify({ error: 'Not a member of this drain' }), { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const meta: { title?: string; description?: string; tags?: string[] } = {}
  if (typeof body.title === 'string' && body.title.trim()) meta.title = body.title.trim()
  if (typeof body.description === 'string') meta.description = body.description.trim() || undefined
  if (Array.isArray(body.tags)) meta.tags = body.tags.filter((t: unknown) => typeof t === 'string')

  const notebook = await getAdminDoc(dbName, 'notebook')
  await putAdminDoc(dbName, { ...notebook, ...meta })
  await updateDirectoryMetaForAllMembers(dbName, meta)

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
