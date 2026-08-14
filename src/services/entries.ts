// @ts-ignore - plain JS module
import { sanitizeHtml } from './sanitize'

export interface EntryIdentity {
  publicUserId: string
  name: string
  color: string
  email: string
}

const isBlank = (html: string) => !html || html === '<p></p>'

// entryUlid is normally client-generated already (a block's stable id in
// the shared editor doc) — pass it through so the doc's _id matches what
// the editor is already tracking, rather than minting a second, unrelated id.
//
// createdByEmail/updatedByEmail (alongside the existing display fields) are
// what the per-drain validate_doc_update function checks against userCtx.name
// (CouchDB's authenticated username, which is the account email) to enforce
// "only the author can edit/delete their own entry."
export async function createEntry(
  db: PouchDB.Database,
  html: string,
  identity: EntryIdentity,
  entryUlid: string
) {
  const sanitized = sanitizeHtml(html)
  if (isBlank(sanitized)) return null

  const now = Date.now()
  const doc = {
    _id: `entry:${entryUlid}`,
    type: 'entry',
    content: sanitized,
    createdBy: identity.publicUserId,
    createdByName: identity.name,
    createdByColor: identity.color,
    createdByEmail: identity.email,
    createdAt: now,
    updatedBy: identity.publicUserId,
    updatedByName: identity.name,
    updatedByColor: identity.color,
    updatedByEmail: identity.email,
    updatedAt: now,
  }
  await db.put(doc)
  return doc
}

// Bounded retry on 409: refetch the latest revision, reapply this edit on
// top of it, and retry instead of silently dropping the edit.
const MAX_SAVE_ATTEMPTS = 3

export async function saveEntry(db: PouchDB.Database, entryId: string, html: string, identity: EntryIdentity) {
  const sanitized = sanitizeHtml(html)

  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
    const doc: any = await db.get(entryId)
    doc.content = sanitized
    doc.updatedBy = identity.publicUserId
    doc.updatedByName = identity.name
    doc.updatedByColor = identity.color
    doc.updatedByEmail = identity.email
    doc.updatedAt = Date.now()

    try {
      await db.put(doc)
      return doc
    } catch (err: any) {
      if (err?.status !== 409 || attempt === MAX_SAVE_ATTEMPTS - 1) throw err
    }
  }
}

// Two clients editing the same entry while offline produces a genuine
// PouchDB conflict on sync (divergent _rev branches under one _id).
// Resolve deterministically on every client: last-write-wins by updatedAt.
export async function resolveConflicts(db: PouchDB.Database, entryId: string) {
  const doc: any = await db.get(entryId, { conflicts: true })
  if (!doc._conflicts?.length) return doc

  const losers = await Promise.all(
    doc._conflicts.map((rev: string) =>
      db.get(entryId, { rev }).catch(() => null)
    )
  )
  const winner = [doc, ...losers.filter(Boolean)].reduce(
    (a: any, b: any) => (b.updatedAt > a.updatedAt ? b : a)
  )

  // Delete losers sequentially to avoid write conflicts during resolution
  for (const loser of [doc, ...losers].filter((c: any) => c._rev !== winner._rev)) {
    try {
      await db.remove(entryId, loser._rev)
    } catch {
      // Non-fatal: losing revision may already be purged
    }
  }

  return winner
}

export async function deleteEntry(db: PouchDB.Database, entryId: string) {
  try {
    const doc = await db.get(entryId)
    await db.remove(doc)
  } catch (err: any) {
    if (err?.status !== 404) throw err
  }
}

export function attributionLabel(entry: any) {
  const same = entry.updatedBy === entry.createdBy && entry.updatedAt === entry.createdAt
  const time = new Date(entry.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return same
    ? `${entry.createdByName} · ${time}`
    : `Created by ${entry.createdByName} · edited by ${entry.updatedByName} at ${time}`
}
