import type { APIRoute } from 'astro'
import { verifyCouchLogin, getAdminDoc } from '@/lib/couchdb-admin'
import { deriveIdentity } from '@/services/identity'

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: any
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400 })
  }

  const ok = await verifyCouchLogin(email, password)
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Incorrect email or password' }), { status: 401 })
  }

  // Password's real identity is name-agnostic — pull the actual on-record
  // name/color from the stored profile doc rather than trusting client input.
  const publicUserId = (await deriveIdentity(email, '')).publicUserId
  const profile = await getAdminDoc('main', `profile:${publicUserId}`)
  if (!profile) {
    return new Response(JSON.stringify({ error: 'No profile found for this account' }), { status: 404 })
  }

  const identity = { publicUserId, name: profile.name, color: profile.color, email }

  cookies.set('sk_identity', JSON.stringify(identity), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  return new Response(JSON.stringify({ identity }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
