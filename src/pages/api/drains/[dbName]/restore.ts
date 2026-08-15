import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { getDirectoryDrains, restoreDrain } from '@/lib/couchdb-admin'

export const prerender = false

export const POST: APIRoute = async ({ request, params }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  const dbName = params.dbName!

  const drains = await getDirectoryDrains(caller.email)
  const mine = drains.find((d) => d.dbName === dbName)
  if (!mine || mine.role !== 'owner') {
    return new Response(JSON.stringify({ error: 'Only the owner can restore this drain' }), { status: 403 })
  }
  if (!mine.trashedAt) {
    return new Response(JSON.stringify({ error: 'This drain is not in trash' }), { status: 400 })
  }

  await restoreDrain(dbName)

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
