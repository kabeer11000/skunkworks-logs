import { db } from './db.js';

const REMOTE_URL = import.meta.env.VITE_COUCHDB_URL || 'http://localhost:5984/main';

let handler = null;

export function startSync(onStatus) {
  if (handler) return handler;
  handler = db.sync(REMOTE_URL, { live: true, retry: true })
    .on('paused', (err) => {
      if (err) {
        onStatus?.('error');
      } else {
        onStatus?.('paused');
      }
    })
    .on('active', () => onStatus?.('active'))
    .on('error', err => {
      console.error('sync error', err);
      onStatus?.('error');
    });
  return handler;
}

export function stopSync() {
  if (handler) {
    handler.cancel();
    handler = null;
  }
}
