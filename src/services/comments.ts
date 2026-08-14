import type { EntryIdentity } from './entries'

export interface CommentDoc {
  _id: string
  _rev?: string
  type: 'comment'
  entryId: string
  commentId: string
  text: string
  authorName: string
  authorColor: string
  authorEmail: string
  createdAt: number
}

const prefix = 'comment:'

export async function loadComments(db: PouchDB.Database): Promise<CommentDoc[]> {
  const res = await db.allDocs({
    startkey: prefix,
    endkey: prefix + '￿',
    include_docs: true,
  })
  return res.rows.map((r: any) => r.doc)
}

// Caller owns the returned handle and must .cancel() it on unmount.
export function watchComments(
  db: PouchDB.Database,
  onChange: (change: { id: string; deleted: boolean; doc?: CommentDoc }) => void
) {
  return db
    .changes({ since: 'now', live: true, include_docs: true })
    .on('change', (change: any) => {
      if (!change.id.startsWith(prefix)) return
      onChange({ id: change.id, deleted: !!change.deleted, doc: change.doc })
    })
}

export async function createComment(
  db: PouchDB.Database,
  entryId: string,
  commentId: string,
  text: string,
  identity: EntryIdentity
): Promise<CommentDoc> {
  const doc: CommentDoc = {
    _id: `${prefix}${commentId}`,
    type: 'comment',
    entryId,
    commentId,
    text,
    authorName: identity.name,
    authorColor: identity.color,
    authorEmail: identity.email,
    createdAt: Date.now(),
  }
  await db.put(doc)
  return doc
}

export async function deleteComment(db: PouchDB.Database, id: string) {
  try {
    const doc = await db.get(id)
    await db.remove(doc)
  } catch (err: any) {
    if (err?.status !== 404) throw err
  }
}
