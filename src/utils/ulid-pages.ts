import { db } from '@/services/db'

const prefix = (notebookId: string) => `entry:${notebookId}:`

export async function loadLatestPage(notebookId: string, limit = 50) {
  const res = await db.allDocs({
    startkey: prefix(notebookId) + '￿',
    endkey: prefix(notebookId),
    descending: true,
    include_docs: true,
    limit,
  })
  return res.rows.map((r: any) => r.doc).reverse()
}

export async function loadOlderPage(notebookId: string, beforeId: string, limit = 50) {
  const res = await db.allDocs({
    startkey: beforeId,
    endkey: prefix(notebookId),
    descending: true,
    skip: 1,
    include_docs: true,
    limit,
  })
  return res.rows.map((r: any) => r.doc).reverse()
}
