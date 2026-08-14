import PouchDB from 'pouchdb';

// One local PouchDB per drain database (drain-<ulid>), instead of a single
// shared 'main' instance — each drain now lives in its own CouchDB database
// for real per-drain access control (see lib/couchdb-admin.ts). The registry
// just avoids creating duplicate PouchDB instances for the same dbName.
const registry = new Map<string, PouchDB.Database>();

export function getDrainDb(dbName: string): PouchDB.Database {
  let instance = registry.get(dbName);
  if (!instance) {
    instance = new PouchDB(dbName);
    registry.set(dbName, instance);
  }
  return instance;
}
