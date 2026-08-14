// Server-only. COUCHDB_ADMIN_URL is NOT VITE_-prefixed, so Vite never inlines
// it into a client bundle — this module must only ever be imported from
// src/pages/api/** route files, never from client components.
//
// Credentials are pulled out of the URL and sent as an explicit Authorization
// header rather than left embedded in the URL passed to fetch() — native
// fetch (both browsers and Node's undici, which is what Vercel functions
// use) rejects URLs containing userinfo ("URL contains credentials").
import { ulid } from 'ulid'

const ADMIN_URL = import.meta.env.COUCHDB_ADMIN_URL as string | undefined

let cached: { origin: string; authHeader: string } | null = null

function admin() {
  if (cached) return cached
  if (!ADMIN_URL) throw new Error('COUCHDB_ADMIN_URL is not configured')
  const parsed = new URL(ADMIN_URL)
  const authHeader = 'Basic ' + Buffer.from(`${parsed.username}:${parsed.password}`).toString('base64')
  const origin = `${parsed.protocol}//${parsed.host}`
  cached = { origin, authHeader }
  return cached
}

async function adminFetch(path: string, init?: RequestInit) {
  const { origin, authHeader } = admin()
  return fetch(`${origin}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      ...(init?.headers || {}),
    },
  })
}

export async function couchUserExists(email: string) {
  const res = await adminFetch(`/_users/org.couchdb.user:${encodeURIComponent(email)}`)
  return res.status === 200
}

export async function createCouchUser(email: string, password: string) {
  const usersDb = await adminFetch(`/_users`, { method: 'PUT' })
  if (!usersDb.ok && usersDb.status !== 412) {
    throw new Error(`Failed to ensure _users database exists (${usersDb.status})`)
  }
  const res = await adminFetch(`/_users/org.couchdb.user:${encodeURIComponent(email)}`, {
    method: 'PUT',
    body: JSON.stringify({ name: email, password, roles: [], type: 'user' }),
  })
  if (!res.ok) throw new Error(`Failed to create CouchDB user (${res.status})`)
}

// Pure password check — CouchDB's /_session is used as the oracle, hit
// anonymously with no admin auth (we're checking THEIR password, not ours).
// We don't use the session cookie it returns: PouchDB syncs cross-origin
// (app on Vercel, CouchDB on Render), and a cookie set by our server's
// response can't be scoped to CouchDB's domain anyway (basic same-origin
// cookie rules, not a SameSite nuance) — the client instead re-authenticates
// its own PouchDB sync directly with the user's own credentials (sync.js).
export async function verifyCouchLogin(email: string, password: string): Promise<boolean> {
  const { origin } = admin()
  const res = await fetch(`${origin}/_session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: email, password }),
  })
  return res.ok
}

// Ensures the shared database exists. Note: an empty _security.members list
// does NOT restrict access to authenticated users — verified directly
// against this instance, an empty members list is wide open to anonymous
// requests too. The actual "must be logged in" enforcement is the
// server-wide chttpd/require_valid_user=true config (set once, out of band,
// with the user's explicit sign-off — it affects the whole CouchDB node,
// not just this database, so it's not something to toggle from app code).
// _security here is reserved for real per-drain member lists in a later
// phase, where a non-empty names list actually does restrict access.
export async function ensureMainDbOpenToAuthenticated() {
  const created = await adminFetch(`/main`, { method: 'PUT' })
  if (!created.ok && created.status !== 412) {
    throw new Error(`Failed to ensure main database exists (${created.status})`)
  }
  await adminFetch(`/main/_security`, {
    method: 'PUT',
    body: JSON.stringify({ admins: { names: [], roles: [] }, members: { names: [], roles: [] } }),
  })
}

export async function putAdminDoc(db: string, doc: Record<string, any>) {
  const res = await adminFetch(`/${db}/${encodeURIComponent(doc._id)}`, {
    method: 'PUT',
    body: JSON.stringify(doc),
  })
  if (!res.ok && res.status !== 409) throw new Error(`Failed to write ${doc._id} (${res.status})`)
  return res
}

export async function getAdminDoc(db: string, id: string) {
  const res = await adminFetch(`/${db}/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to read ${id} (${res.status})`)
  return res.json()
}

// Get-mutate-put with a bounded retry on 409, same pattern as
// services/entries.ts's saveEntry — for docs multiple requests might touch
// concurrently (namely each user's own directory doc, which invites and
// their own signup could both touch around the same time).
export async function updateAdminDoc(
  db: string,
  id: string,
  mutate: (doc: any) => any,
  defaultDoc: () => any
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await getAdminDoc(db, id)
    const doc = mutate(existing ?? defaultDoc())
    const res = await adminFetch(`/${db}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(doc),
    })
    if (res.ok) return res.json()
    if (res.status !== 409) throw new Error(`Failed to update ${id} (${res.status})`)
  }
  throw new Error(`Failed to update ${id} after retries`)
}

const VALIDATE_DOC_UPDATE = `function(newDoc, oldDoc, userCtx) {
  if (userCtx.roles.indexOf('_admin') !== -1) return;
  if (!oldDoc) return;
  if (oldDoc.type === 'entry' || oldDoc.type === 'comment') {
    var owner = oldDoc.createdByEmail || oldDoc.authorEmail;
    if (owner && owner !== userCtx.name) {
      throw({forbidden: 'Only the original author can edit or delete this.'});
    }
  }
}`

// Creates a drain's own database with real membership-based access control:
// only the listed emails can read or write it at all (CouchDB-enforced, not
// app-side hiding), and within it, only a doc's own author can edit/delete
// an existing entry/comment (validate_doc_update) — anyone a member can add.
export async function provisionDrainDatabase(dbName: string, ownerEmail: string) {
  const created = await adminFetch(`/${dbName}`, { method: 'PUT' })
  if (!created.ok && created.status !== 412) {
    throw new Error(`Failed to create drain database ${dbName} (${created.status})`)
  }
  await adminFetch(`/${dbName}/_security`, {
    method: 'PUT',
    body: JSON.stringify({
      admins: { names: [], roles: [] },
      members: { names: [ownerEmail], roles: [] },
    }),
  })
  await adminFetch(`/${dbName}/_design/access`, {
    method: 'PUT',
    body: JSON.stringify({ _id: '_design/access', validate_doc_update: VALIDATE_DOC_UPDATE }),
  })
}

export async function getDrainMembers(dbName: string): Promise<string[]> {
  const res = await adminFetch(`/${dbName}/_security`)
  if (!res.ok) throw new Error(`Failed to read security for ${dbName} (${res.status})`)
  const security = await res.json()
  return security?.members?.names ?? []
}

export async function addDrainMember(dbName: string, email: string) {
  const members = await getDrainMembers(dbName)
  if (members.includes(email)) return
  await adminFetch(`/${dbName}/_security`, {
    method: 'PUT',
    body: JSON.stringify({
      admins: { names: [], roles: [] },
      members: { names: [...members, email], roles: [] },
    }),
  })
}

export async function removeDrainMember(dbName: string, email: string) {
  const members = await getDrainMembers(dbName)
  await adminFetch(`/${dbName}/_security`, {
    method: 'PUT',
    body: JSON.stringify({
      admins: { names: [], roles: [] },
      members: { names: members.filter((m) => m !== email), roles: [] },
    }),
  })
}

export async function deleteDrainDatabase(dbName: string) {
  const res = await adminFetch(`/${dbName}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete ${dbName} (${res.status})`)
}

// Directory: one doc per email listing which drain databases they belong
// to. Admin-only database — the app never talks to it directly, only
// through the /api/drains* server routes, since "which drains can I see"
// is a cross-database question CouchDB can't answer for an unprivileged
// client. Keyed by email so an invite can be recorded before the invitee
// has even signed up yet — no separate "pending invite" concept needed.
const DIRECTORY_DB = 'directory'

export async function ensureDirectoryDbExists() {
  const res = await adminFetch(`/${DIRECTORY_DB}`, { method: 'PUT' })
  if (!res.ok && res.status !== 412) {
    throw new Error(`Failed to ensure directory database exists (${res.status})`)
  }
}

export interface DirectoryDrainEntry {
  dbName: string
  title: string
  description?: string
  tags?: string[]
  visibility: 'private' | 'shared'
  role: 'owner' | 'member'
  joinedAt: number
}

export async function getDirectoryDrains(email: string): Promise<DirectoryDrainEntry[]> {
  const doc = await getAdminDoc(DIRECTORY_DB, `user:${email}`)
  return doc?.drains ?? []
}

export async function addDirectoryDrain(email: string, entry: DirectoryDrainEntry) {
  await ensureDirectoryDbExists()
  await updateAdminDoc(
    DIRECTORY_DB,
    `user:${email}`,
    (doc) => ({ ...doc, drains: [...(doc.drains ?? []), entry] }),
    () => ({ _id: `user:${email}`, type: 'directory', drains: [] })
  )
}

export async function removeDirectoryDrain(email: string, dbName: string) {
  await updateAdminDoc(
    DIRECTORY_DB,
    `user:${email}`,
    (doc) => ({ ...doc, drains: (doc.drains ?? []).filter((d: DirectoryDrainEntry) => d.dbName !== dbName) }),
    () => ({ _id: `user:${email}`, type: 'directory', drains: [] })
  )
}

// Both public share links (`/public/:token`) and GitHub ingestion URLs
// (`/api/ingest/:token`) need to resolve a bare token back to a dbName
// without knowing it in advance — no per-drain database can answer "which
// token points at me" for a request that doesn't know which database to ask
// yet, so the reverse mapping lives as its own doc in the directory
// database, the one admin-only db already used for this kind of
// cross-database lookup. `kind` namespaces the two token spaces (a
// `public:<token>` doc can't collide with an `ingest:<token>` doc even if
// the token strings ever matched). The token is also cached on the drain's
// own notebook doc under `${kind}Token`, purely so the owner's edit dialog
// can show current status without a second lookup.
async function setDrainToken(dbName: string, kind: 'public' | 'ingest', token: string | null) {
  const field = `${kind}Token`
  const notebook = await getAdminDoc(dbName, 'notebook')
  const oldToken = notebook?.[field] as string | undefined
  if (oldToken && oldToken !== token) {
    const oldDoc = await getAdminDoc(DIRECTORY_DB, `${kind}:${oldToken}`)
    if (oldDoc) {
      await adminFetch(`/${DIRECTORY_DB}/${encodeURIComponent(oldDoc._id)}?rev=${oldDoc._rev}`, { method: 'DELETE' }).catch(() => {})
    }
  }
  await putAdminDoc(dbName, { ...notebook, [field]: token ?? undefined })
  if (token) {
    await ensureDirectoryDbExists()
    await putAdminDoc(DIRECTORY_DB, { _id: `${kind}:${token}`, dbName })
  }
}

async function getDrainByToken(kind: 'public' | 'ingest', token: string): Promise<{ dbName: string } | null> {
  const doc = await getAdminDoc(DIRECTORY_DB, `${kind}:${token}`)
  return doc ? { dbName: doc.dbName } : null
}

export const setDrainPublicToken = (dbName: string, token: string | null) => setDrainToken(dbName, 'public', token)
export const getDrainByPublicToken = (token: string) => getDrainByToken('public', token)

export const setDrainIngestionToken = (dbName: string, token: string | null) => setDrainToken(dbName, 'ingest', token)
export const getDrainByIngestionToken = (token: string) => getDrainByToken('ingest', token)

// Ingestion tokens always exist once first requested (unlike publish, which
// is an explicit opt-in) — the URL itself only becomes live once the owner
// actually adds it as a GitHub webhook, so there's no "leak" from having one
// ready before that.
export async function getOrCreateIngestionToken(dbName: string): Promise<string> {
  const notebook = await getAdminDoc(dbName, 'notebook')
  if (notebook?.ingestToken) return notebook.ingestToken
  const token = ulid()
  await setDrainIngestionToken(dbName, token)
  return token
}

export async function recordIngestionEvent(dbName: string) {
  const notebook = await getAdminDoc(dbName, 'notebook')
  await putAdminDoc(dbName, { ...notebook, lastIngestedAt: Date.now() })
}

// Shape shared by every non-human-authored entry (GitHub ingestion, AI
// summaries) — a fixed identity instead of a real user's, so EntryBlockView
// can render a distinct badge via the `source` field (see BlockParagraph.ts).
interface BotAuthor {
  createdBy: string
  createdByName: string
  createdByColor: string
  createdByEmail: string
  source: string
}

async function putBotEntry(dbName: string, content: string, author: BotAuthor, createdAt: number) {
  const doc = {
    _id: `entry:${ulid()}`,
    type: 'entry',
    content,
    ...author,
    updatedBy: author.createdBy,
    updatedByName: author.createdByName,
    updatedByColor: author.createdByColor,
    updatedByEmail: author.createdByEmail,
    createdAt,
    updatedAt: createdAt,
  }
  await putAdminDoc(dbName, doc)
}

const GITHUB_AUTHOR: BotAuthor = {
  createdBy: 'github-ingestion',
  createdByName: 'GitHub',
  createdByColor: '#6e5494',
  createdByEmail: 'github-ingestion@skunkworks.local',
  source: 'github',
}

export async function createIngestedEntry(dbName: string, content: string, createdAt: number) {
  await putBotEntry(dbName, content, GITHUB_AUTHOR, createdAt)
}

const AI_SUMMARY_AUTHOR: BotAuthor = {
  createdBy: 'ai-summary',
  createdByName: 'AI Summary',
  createdByColor: '#7c3aed',
  createdByEmail: 'ai-summary@skunkworks.local',
  source: 'ai-summary',
}

export async function createSummaryEntry(dbName: string, content: string) {
  await putBotEntry(dbName, content, AI_SUMMARY_AUTHOR, Date.now())
}

export async function getEntriesByIds(dbName: string, ids: string[]) {
  const res = await adminFetch(`/${dbName}/_all_docs?include_docs=true`, {
    method: 'POST',
    body: JSON.stringify({ keys: ids }),
  })
  if (!res.ok) throw new Error(`Failed to read entries for ${dbName} (${res.status})`)
  const data = await res.json()
  return data.rows.map((r: any) => r.doc).filter(Boolean)
}

export async function getPublicEntries(dbName: string) {
  const qs = new URLSearchParams({
    startkey: JSON.stringify('entry:'),
    endkey: JSON.stringify('entry:￿'),
    include_docs: 'true',
  })
  const res = await adminFetch(`/${dbName}/_all_docs?${qs}`)
  if (!res.ok) throw new Error(`Failed to read entries for ${dbName} (${res.status})`)
  const data = await res.json()
  return data.rows
    .map((r: any) => r.doc)
    .filter(Boolean)
    .sort((a: any, b: any) => a.createdAt - b.createdAt)
}

// The directory caches each drain's title/description/tags so the sidebar
// can list drains without opening every member's database — update every
// current member's cached copy when a drain's metadata changes.
export async function updateDirectoryMetaForAllMembers(
  dbName: string,
  meta: { title?: string; description?: string; tags?: string[] }
) {
  const members = await getDrainMembers(dbName)
  for (const email of members) {
    await updateAdminDoc(
      DIRECTORY_DB,
      `user:${email}`,
      (doc) => ({
        ...doc,
        drains: (doc.drains ?? []).map((d: DirectoryDrainEntry) => (d.dbName === dbName ? { ...d, ...meta } : d)),
      }),
      () => ({ _id: `user:${email}`, type: 'directory', drains: [] })
    )
  }
}
