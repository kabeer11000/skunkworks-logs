import { getAuthCredential } from './authSession'
import type { DirectoryDrainEntry } from '@/lib/couchdb-admin'

function authHeader() {
  const cred = getAuthCredential()
  if (!cred) throw new Error('Not signed in')
  return 'Basic ' + btoa(`${cred.email}:${cred.password}`)
}

async function parseErrorOr<T>(res: Response, fallback: string): Promise<T> {
  if (res.ok) return res.json()
  const body = await res.json().catch(() => ({}))
  throw new Error(body.error || fallback)
}

export async function fetchDrains(): Promise<DirectoryDrainEntry[]> {
  const res = await fetch('/api/drains', { headers: { Authorization: authHeader() } })
  const data = await parseErrorOr<{ drains: DirectoryDrainEntry[] }>(res, 'Failed to load drains')
  return data.drains
}

export async function createDrain(
  title: string,
  visibility: 'private' | 'shared',
  description?: string,
  tags?: string[]
): Promise<{ dbName: string }> {
  const res = await fetch('/api/drains', {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, visibility, description, tags }),
  })
  return parseErrorOr(res, 'Failed to create drain')
}

export async function deleteDrainApi(dbName: string): Promise<void> {
  const res = await fetch(`/api/drains/${dbName}`, {
    method: 'DELETE',
    headers: { Authorization: authHeader() },
  })
  await parseErrorOr(res, 'Failed to delete drain')
}

export async function updateDrainApi(
  dbName: string,
  meta: { title?: string; description?: string; tags?: string[] }
): Promise<void> {
  const res = await fetch(`/api/drains/${dbName}`, {
    method: 'PATCH',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  })
  await parseErrorOr(res, 'Failed to update drain')
}

export async function inviteToDrain(dbName: string, email: string): Promise<void> {
  const res = await fetch(`/api/drains/${dbName}/invite`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  await parseErrorOr(res, 'Failed to invite')
}

export async function listDrainMembers(dbName: string): Promise<string[]> {
  const res = await fetch(`/api/drains/${dbName}/members`, { headers: { Authorization: authHeader() } })
  const data = await parseErrorOr<{ members: string[] }>(res, 'Failed to load members')
  return data.members
}

export async function removeDrainMemberApi(dbName: string, email: string): Promise<void> {
  const res = await fetch(`/api/drains/${dbName}/members`, {
    method: 'DELETE',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  await parseErrorOr(res, 'Failed to remove member')
}
