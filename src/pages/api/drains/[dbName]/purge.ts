import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { getDirectoryDrains, purgeDrainNow } from '@/lib/couchdb-admin'

export const prerender = false

// The explicit, clearly-dangerous "delete forever, right now" action —
// only reachable from the trash view, not the normal drain list's delete
// button (that one soft-deletes via DELETE /api/drains/:dbName). Only
// works on a drain already in trash, so this can't be used to skip the
// trash step from the normal UI.
export const DELETE: APIRoute = async ({ request, params }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  const dbName = params.dbName!

  const drains = await getDirectoryDrains(caller.email)
  const mine = drains.find((d) => d.dbName === dbName)
  if (!mine || mine.role !== 'owner') {
    return new Response(JSON.stringify({ error: 'Only the owner can permanently delete this drain' }), { status: 403 })
  }
  if (!mine.trashedAt) {
    return new Response(JSON.stringify({ error: 'This drain must be in trash before it can be permanently deleted' }), {
      status: 400,
    })
  }

  await purgeDrainNow(dbName)

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
