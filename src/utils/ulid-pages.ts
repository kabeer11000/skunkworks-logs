const prefix = 'entry:'

export async function loadLatestPage(db: PouchDB.Database, limit = 50) {
  const res = await db.allDocs({
    startkey: prefix + '￿',
    endkey: prefix,
    descending: true,
    include_docs: true,
    limit,
  })
  return res.rows.map((r: any) => r.doc).reverse()
}

export async function loadOlderPage(db: PouchDB.Database, beforeId: string, limit = 50) {
  const res = await db.allDocs({
    startkey: beforeId,
    endkey: prefix,
    descending: true,
    skip: 1,
    include_docs: true,
    limit,
  })
  return res.rows.map((r: any) => r.doc).reverse()
}
