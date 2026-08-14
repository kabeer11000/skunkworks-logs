import { db } from './db'
import type { EntryIdentity } from './entries'

export interface CommentDoc {
  _id: string
  _rev?: string
  type: 'comment'
  notebookId: string
  entryId: string
  commentId: string
  text: string
  authorName: string
  authorColor: string
  createdAt: number
}

const prefix = (notebookId: string) => `comment:${notebookId}:`

export async function loadComments(notebookId: string): Promise<CommentDoc[]> {
  const res = await db.allDocs({
    startkey: prefix(notebookId),
    endkey: prefix(notebookId) + '￿',
    include_docs: true,
  })
  return res.rows.map((r: any) => r.doc)
}

// Caller owns the returned handle and must .cancel() it on unmount — comments
// are scoped to whichever drain is currently open, unlike the app-wide
// drains list in helpers/drains.ts, so this isn't a module-level singleton.
export function watchComments(
  notebookId: string,
  onChange: (change: { id: string; deleted: boolean; doc?: CommentDoc }) => void
) {
  const p = prefix(notebookId)
  return db
    .changes({ since: 'now', live: true, include_docs: true })
    .on('change', (change: any) => {
      if (!change.id.startsWith(p)) return
      onChange({ id: change.id, deleted: !!change.deleted, doc: change.doc })
    })
}

export async function createComment(
  notebookId: string,
  entryId: string,
  commentId: string,
  text: string,
  identity: EntryIdentity
): Promise<CommentDoc> {
  const doc: CommentDoc = {
    _id: `${prefix(notebookId)}${commentId}`,
    type: 'comment',
    notebookId,
    entryId,
    commentId,
    text,
    authorName: identity.name,
    authorColor: identity.color,
    createdAt: Date.now(),
  }
  await db.put(doc)
  return doc
}

export async function deleteComment(id: string) {
  try {
    const doc = await db.get(id)
    await db.remove(doc)
  } catch (err: any) {
    if (err?.status !== 404) throw err
  }
}
