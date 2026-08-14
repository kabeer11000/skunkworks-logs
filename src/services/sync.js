import { db } from './db.js';
import { $syncStatus } from '../stores/sync';

const REMOTE_URL = import.meta.env.VITE_COUCHDB_URL || 'http://admin:password@localhost:5984/main';

let handler = null;

// Safe to call from multiple places (AppSidebar on every page load, plus
// SyncIndicator on the drain page) — writes to the shared $syncStatus store
// instead of a per-caller callback, so every caller sees the same state
// regardless of who actually started the sync.
export function startSync() {
  if (handler) return handler;
  handler = db.sync(REMOTE_URL, { live: true, retry: true })
    .on('paused', (err) => {
      $syncStatus.set(err ? 'error' : 'paused');
    })
    .on('active', () => $syncStatus.set('active'))
    .on('error', err => {
      console.error('sync error', err);
      $syncStatus.set('error');
    });
  return handler;
}

export function stopSync() {
  if (handler) {
    handler.cancel();
    handler = null;
  }
  $syncStatus.set(null);
}
