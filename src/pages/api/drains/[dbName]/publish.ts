import type { APIRoute } from 'astro'
import { ulid } from 'ulid'
import { requireAuth } from '@/lib/requireAuth'
import { getDirectoryDrains, setDrainPublicToken, getAdminDoc } from '@/lib/couchdb-admin'

export const prerender = false

async function requireOwner(request: Request, dbName: string) {
  const caller = await requireAuth(request)
  if (!caller) return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) }
  const drains = await getDirectoryDrains(caller.email)
  const mine = drains.find((d) => d.dbName === dbName)
  if (!mine || mine.role !== 'owner') {
    return { error: new Response(JSON.stringify({ error: 'Only the owner can publish this drain' }), { status: 403 }) }
  }
  return { caller }
}

export const GET: APIRoute = async ({ request, params }) => {
  const dbName = params.dbName!
  const { error } = await requireOwner(request, dbName)
  if (error) return error

  const notebook = await getAdminDoc(dbName, 'notebook')
  return new Response(
    JSON.stringify({ token: notebook?.publicToken ?? null }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

export const POST: APIRoute = async ({ request, params }) => {
  const dbName = params.dbName!
  const { error } = await requireOwner(request, dbName)
  if (error) return error

  const token = ulid()
  await setDrainPublicToken(dbName, token)
  return new Response(JSON.stringify({ token }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export const DELETE: APIRoute = async ({ request, params }) => {
  const dbName = params.dbName!
  const { error } = await requireOwner(request, dbName)
  if (error) return error

  await setDrainPublicToken(dbName, null)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
