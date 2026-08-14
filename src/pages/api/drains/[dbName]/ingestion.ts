import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { getDirectoryDrains, getOrCreateIngestionToken, setDrainIngestionToken, getAdminDoc } from '@/lib/couchdb-admin'

export const prerender = false

async function requireOwner(request: Request, dbName: string) {
  const caller = await requireAuth(request)
  if (!caller) return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) }
  const drains = await getDirectoryDrains(caller.email)
  const mine = drains.find((d) => d.dbName === dbName)
  if (!mine || mine.role !== 'owner') {
    return { error: new Response(JSON.stringify({ error: 'Only the owner can manage integrations' }), { status: 403 }) }
  }
  return { caller }
}

export const GET: APIRoute = async ({ request, params }) => {
  const dbName = params.dbName!
  const { error } = await requireOwner(request, dbName)
  if (error) return error

  const token = await getOrCreateIngestionToken(dbName)
  const notebook = await getAdminDoc(dbName, 'notebook')
  return new Response(
    JSON.stringify({ token, lastIngestedAt: notebook?.lastIngestedAt ?? null }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

// Regenerates the token (revokes the old one immediately).
export const POST: APIRoute = async ({ request, params }) => {
  const dbName = params.dbName!
  const { error } = await requireOwner(request, dbName)
  if (error) return error

  const token = crypto.randomUUID().replace(/-/g, '')
  await setDrainIngestionToken(dbName, token)
  return new Response(JSON.stringify({ token }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
