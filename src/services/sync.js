import { getDrainDb } from './db.js';
import { $syncStatus } from '../stores/sync';
import { getAuthCredential } from './authSession';

const REMOTE_HOST = (import.meta.env.VITE_COUCHDB_URL || 'http://localhost:5984/main').replace(/\/[^/]*$/, '');

// One live sync handler per currently-open drain database, keyed by dbName.
// $syncStatus reflects whichever drain was most recently active — good
// enough for the single status pill in the UI; per-drain status isn't
// surfaced anywhere yet.
const handlers = new Map();

export function startDrainSync(dbName) {
  if (handlers.has(dbName)) return handlers.get(dbName);
  const credential = getAuthCredential();
  if (!credential) return null;

  const handler = getDrainDb(dbName)
    .sync(`${REMOTE_HOST}/${dbName}`, {
      live: true,
      retry: true,
      auth: { username: credential.email, password: credential.password },
    })
    .on('paused', (err) => {
      $syncStatus.set(err ? 'error' : 'paused');
    })
    .on('active', () => $syncStatus.set('active'))
    .on('error', (err) => {
      console.error('sync error', dbName, err);
      $syncStatus.set('error');
    });
  handlers.set(dbName, handler);
  return handler;
}

export function stopDrainSync(dbName) {
  const handler = handlers.get(dbName);
  if (handler) {
    handler.cancel();
    handlers.delete(dbName);
  }
}

export function stopAllSync() {
  handlers.forEach((h) => h.cancel());
  handlers.clear();
  $syncStatus.set(null);
}
