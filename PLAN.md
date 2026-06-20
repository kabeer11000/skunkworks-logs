# SkunkWorks / Logs — Implementation Plan

This is the single source of truth for building the app. It supersedes any earlier draft. Where a decision was ambiguous in prior discussion, an explicit assumption is stated — see **Section 16**. Confirm or correct those before/while building; everything else here is locked.

---

## 1. Product Summary

A minimalist, offline-first notebook app for developers to write changelogs. Plain Web Components (Lit), no React/Vue. Local-first via PouchDB, syncing to a CouchDB instance on Render. Two notebook types: **shared** (plaintext, everyone can read/write) and **private** (end-to-end encrypted, key never synced). Entries are editable blocks with edit attribution, not append-only. Identity is just name + email, asked once per device, never asked again.

Locked structural assumption (flag if wrong): the notebook is a **vertically-scrolling, chronologically-ordered feed** — like a changelog or chat log — not a 2D pannable canvas. This affects every rendering decision below.

---

## 2. Tech Stack

| Purpose | Library | Notes |
|---|---|---|
| Component base | **Lit** | Real `LitElement` subclasses everywhere — not vanilla `HTMLElement` with an unused Lit import |
| UI components | **@material/web** | Confirmed still in maintenance mode (Google reassigned the team, no roadmap, not deprecated). Pin an exact version on install; budget for patching it yourself if you hit an edge case |
| Local DB + sync | **PouchDB** | Now developed as `apache/pouchdb` under Apache Incubation, recently shipped a major v9 release (default `.find()` result limit dropped to 25, indexeddb adapter rewritten). This plan avoids `pouchdb-find` entirely and uses `allDocs` range queries instead — sidesteps that limit and any mango-query churn |
| Rich text editing | **Tiptap** (`@tiptap/core` + `@tiptap/starter-kit`) | Actively maintained |
| Sanitization | **DOMPurify** | Run on every entry, every time, before storage *and* before render — shared and private alike |
| Sortable IDs | **ulid** | Timestamp-prefixed → free chronological ordering via `allDocs({startkey, endkey})` |
| Encryption | **Web Crypto API** (native, no library) | AES-GCM, fresh random IV every encrypt call |
| Offline app shell | **vite-plugin-pwa** (Workbox) | Caches HTML/JS/CSS so the app loads with zero network — separate concern from PouchDB caching data |
| Bundler | **Vite** | — |

Install everything at `latest`, then pin in `package.json` and commit the lockfile. Don't guess version numbers.

---

## 3. Project Structure

```
skunkworks-logs/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── public/
│   └── icons/                    # PWA icons (192, 512)
├── src/
│   ├── main.js                   # registers all custom elements, mounts <app-root>
│   ├── styles/
│   │   └── global.css            # reset only — no theming section in this plan
│   ├── services/
│   │   ├── db.js                 # local PouchDB instance
│   │   ├── sync.js                # remote replication to CouchDB on Render
│   │   ├── identity.js           # derive publicUserId + color from email
│   │   ├── crypto.js             # AES-GCM key gen/encrypt/decrypt
│   │   ├── vault.js               # localStorage-only store of private notebook keys
│   │   └── sanitize.js           # single shared DOMPurify wrapper + allowlist
│   ├── components/
│   │   ├── app-root.js
│   │   ├── onboarding-dialog.js
│   │   ├── sidebar-nav.js
│   │   ├── new-notebook-dialog.js
│   │   ├── unlock-notebook-dialog.js
│   │   ├── locked-notebook.js
│   │   ├── notebook-view.js
│   │   ├── entry-composer.js
│   │   └── log-entry.js
│   └── utils/
│       ├── debounce.js
│       └── ulid-pages.js          # allDocs pagination helpers
```

---

## 4. Identity Model

Asked exactly once **per device** (it's local-only, not synced — that's intentional, see below). Name and email go in, and from email a deterministic identity is derived, so the same person gets the same `publicUserId` and color automatically on any device just by entering the same email again. No "restore my identity" flow needed.

```js
// services/identity.js
export async function deriveIdentity(email, name) {
  const normalized = email.trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalized);
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
  const hashHex = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');

  const publicUserId = hashHex.slice(0, 12);
  const hue = parseInt(hashHex.slice(0, 8), 16) % 360;
  const color = `hsl(${hue}, 35%, 45%)`; // muted, deliberately low-saturation so it sits quietly against grayscale UI

  return { publicUserId, name, color, email: normalized };
}
```

Store `{ publicUserId, name, color, email }` in `localStorage` under `sk_identity` (never synced). Also write a `profile:<publicUserId>` doc to PouchDB (public, synced) so other clients can resolve name/color for hover tooltips on entries from other people.

`app-root` gate: on boot, if `localStorage.sk_identity` is missing, show `<onboarding-dialog>` and block everything else. Once set, proceed to init DB + sync.

---

## 5. Data Model

```js
// profile:<publicUserId> — public, always plaintext, always synced
{
  _id: 'profile:8f2a91',
  type: 'profile',
  publicUserId: '8f2a91',
  name: 'Kabeer',
  color: 'hsl(212, 35%, 45%)',
  createdAt: 1750000000000
}

// notebook:<ulid> — metadata doc, synced; title is plaintext for 'shared', ciphertext for 'private'
{
  _id: 'notebook:01HXNB...',
  type: 'notebook',
  visibility: 'shared' | 'private',
  title: 'Release notes' | null,        // null when visibility = 'private'
  titleCipher: { iv, data } | null,     // present only when visibility = 'private'
  createdBy: '8f2a91',
  createdAt: 1750000000000
}

// entry:<notebookId>:<ulid> — one per block, editable
{
  _id: 'entry:01HXNB...:01HXEN...',
  type: 'entry',
  notebookId: '01HXNB...',
  createdBy: 'asad-id',
  createdByName: 'Asad',
  createdByColor: 'hsl(...)',
  createdAt: 1750000000000,
  updatedBy: 'kabeer-id',      // equals createdBy until the first real edit
  updatedByName: 'Kabeer',
  updatedByColor: 'hsl(...)',
  updatedAt: 1750003600000,    // equals createdAt until the first real edit
  content: '<p>Fixed NPT block delete</p>' | null,   // present when notebook is 'shared'
  contentCipher: { iv, data } | null                  // present when notebook is 'private'
}
```

`iv` and `data` are both base64 strings. Author info on entries is **denormalized at write time, both for creation and for each edit** — this keeps rendering fast (no live profile joins) and means historical entries keep showing who actually touched them even if that person later changes their display name.

ULID gives `allDocs({startkey, endkey})` free chronological pagination — this is why entry IDs embed the notebook ID as a prefix.

---

## 6. Privacy & Encryption

**Two visibility tiers only: `shared` and `private`.** There is no sharing case to design around for private notebooks — private is purely for one person's own continuity across their own devices.

Each **private notebook gets its own randomly generated AES-256-GCM key**, generated client-side at creation time, shown exactly once in the sidebar with a copy button and an explicit, unambiguous warning that it cannot be recovered if lost. *(This is the per-notebook design called for by the schema above — see Section 16, item 1, for why this is the assumption used instead of one universal key per person.)*

```js
// services/crypto.js
export async function generateNotebookKey() {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(raw); // this string is what gets shown in the sidebar
}

export async function importNotebookKey(base64Key) {
  const raw = fromBase64(base64Key);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function encryptString(cryptoKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // fresh IV every single call — never reuse
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(plaintext));
  return { iv: toBase64(iv), data: toBase64(data) };
}

export async function decryptString(cryptoKey, { iv, data }) {
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    cryptoKey,
    fromBase64(data)
  );
  return new TextDecoder().decode(plainBuf);
}
```

**Vault (`services/vault.js`)**: a single `localStorage` key, `sk_vault`, holding `{ [notebookId]: base64Key }`. This object is **never** written into any PouchDB document and therefore can never replicate to CouchDB. Sync only ever carries plaintext (shared) or ciphertext (private) — the thing that makes decryption possible never leaves the device except by the user manually copying the key string out of the sidebar.

**Create a private notebook**: generate key → encrypt title with it → save `notebook` doc with `titleCipher` set, `title: null` → store key in vault → show the one-time "copy your key" modal.

**Move to a new device / unlock**: the notebook still shows up in the sidebar on every device (the metadata doc syncs to everyone — that part can't be hidden without per-user databases, out of scope here), but renders as a generic **"Locked notebook"** placeholder with no title shown, plus an "Enter key" action. Pasting the correct key: import it, attempt to decrypt `titleCipher`; on success, store in vault and reveal; on failure, show "invalid key" and don't store it.

Key loss is permanent and by design — there is no recovery flow, because anything that could recover the key would also let whoever has read access to CouchDB recover it.

---

## 7. Entry Lifecycle

**Create:**
1. Sanitize the HTML (Section 9). If it's empty after sanitizing, don't save.
2. `id = entry:${notebookId}:${ulid()}`
3. `createdBy/createdByName/createdByColor/createdAt` from current identity; `updatedBy/updatedByName/updatedByColor/updatedAt` set to the same values.
4. If notebook is `shared`: `content = sanitizedHtml`, `contentCipher = null`. If `private`: look up the key in the vault (if missing, block save and prompt to unlock first), `contentCipher = await encryptString(key, sanitizedHtml)`, `content = null`.
5. `db.put(doc)`.

**Edit (any user can edit any entry):**
1. Sanitize the new HTML.
2. `doc = await db.get(entryId)`.
3. Set `updatedBy/updatedByName/updatedByColor/updatedAt` to the current user/time. **Do not touch `createdBy`/`createdAt`.**
4. Re-apply the same shared/private branching for content.
5. `await db.put(doc)`. On a `409` (someone else just saved a newer local revision), refetch, reapply your edits on top of the new `_rev`, retry — a small bounded retry loop (e.g. 3 attempts), not a custom merge. This is separate from the cross-device conflict case below, which handles two *already-diverged* revisions arriving via sync.

**Attribution display rule:**
```js
function attributionLabel(entry) {
  const same = entry.updatedBy === entry.createdBy && entry.updatedAt === entry.createdAt;
  return same
    ? `${entry.createdByName} · ${formatTime(entry.createdAt)}`
    : `Created by ${entry.createdByName} · edited by ${entry.updatedByName} at ${formatTime(entry.updatedAt)}`;
}
```
If A edits B's entry, this correctly renders "Created by B · edited by A at [time]."

**Future history, without building it now:** leave a `recordRevision(doc)` call site in the save path that's currently a no-op. When real history is wanted later, that function starts writing `revision:<entryId>:<rev>` docs (author, timestamp, full content snapshot) before the entry is overwritten — additive, no migration of existing entries required.

---

## 8. Conflict Resolution

Because any user can edit any block, two people editing the same entry while both offline produces a genuine PouchDB conflict on sync (two `_rev` branches under one `_id`). This must be resolved explicitly and identically on every client — last-write-wins by `updatedAt`:

```js
async function resolveConflicts(id) {
  const doc = await db.get(id, { conflicts: true });
  if (!doc._conflicts) return;
  const losers = await Promise.all(doc._conflicts.map(rev => db.get(id, { rev })));
  const winner = [doc, ...losers].reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
  await Promise.all(
    [doc, ...losers]
      .filter(c => c._rev !== winner._rev)
      .map(c => db.remove(id, c._rev))
  );
}
```

Wire this into the live changes feed — **`conflicts: true` must be passed to `changes()` or `_conflicts` never appears on the doc**:

```js
db.changes({ since: 'now', live: true, include_docs: true, conflicts: true })
  .on('change', change => {
    if (change.doc._conflicts) resolveConflicts(change.id);
    // ...then route the change to the rendering layer, see Section 11
  });
```

This is last-write-wins by timestamp, which discards the losing edit's content for now — that's the deliberate trade-off of not building full history yet. Once `recordRevision()` is real, snapshot the loser before removing it instead of discarding it.

**Debounce the editor**, both to reduce write volume and to shrink the window where two people are mid-edit on the same block at once:

```js
// utils/debounce.js
let saveTimer;
export function onEditorUpdate(editor, cb) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => cb(editor.getHTML()), 800);
}
```

---

## 9. Sanitization Policy

One function, used everywhere, no exceptions for "this one's private so it's fine":

```js
// services/sanitize.js
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p','strong','em','s','code','pre','blockquote','ul','ol','li','h1','h2','h3','br','a','hr'];
const ALLOWED_ATTR = ['href','target','rel'];

export function sanitizeHtml(dirty) {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS, ALLOWED_ATTR });
}
```

Call it **before saving** (on the plaintext, before any encryption) and **again before rendering** (on shared content as-is, and on private content right after decryption, before it's ever set as `innerHTML`). A compromised or malicious peer device syncing in raw HTML is an XSS vector regardless of whether the note is private — encryption protects confidentiality, not the renderer.

---

## 10. Sync & CouchDB on Render

One single database — no filtered replication per visibility tier, that's over-engineering for this. Local instance:

```js
// services/db.js
import PouchDB from 'pouchdb';
export const db = new PouchDB('skunkworks-logs');
```

```js
// services/sync.js
import { db } from './db.js';
const REMOTE_URL = import.meta.env.VITE_COUCHDB_URL;

let handler = null;
export function startSync(onStatus) {
  handler = db.sync(REMOTE_URL, { live: true, retry: true })
    .on('paused', () => onStatus?.('paused'))
    .on('active', () => onStatus?.('active'))
    .on('error', err => console.error('sync error', err));
  return handler;
}
```

Render-side setup (outside the app codebase, do this in CouchDB's config/Fauxton):
- Create the database (e.g. `skunkworks_logs`).
- Enable CORS for your app's deployed origin: `[httpd] enable_cors = true`, `[cors] origins = https://your-app-domain`, credentials enabled, methods GET/PUT/POST/DELETE.
- Create a dedicated CouchDB user for sync rather than using the admin account; restrict via a `_security` doc on the database if you want it to be more than "anyone with the URL can write."

`VITE_COUCHDB_URL` goes in `.env` (gitignored), something like `https://user:pass@your-instance.onrender.com/skunkworks_logs`. **Be explicit with yourself about the trade-off**: anything embedded in the shipped Vite bundle is visible to anyone who opens devtools' network tab — they can't decrypt private content, but they could vandalize the shared log or wipe ciphertext. For a small trusted team this is a reasonable risk to accept deliberately; if this ever leaves a closed team, put a thin authenticating proxy in front of CouchDB instead of shipping credentials client-side.

---

## 11. Rendering Architecture

**The single biggest fix versus earlier drafts: don't keep a full array of entries in memory and re-render everything on every `changes()` event.** At 50 entries that's fine; at 5,000 it repaints the whole DOM tree on every remote keystroke. Two things fix this:

**(a) Paginate with ulid ranges, not "load everything":**

```js
// utils/ulid-pages.js
const prefix = (notebookId) => `entry:${notebookId}:`;

export async function loadLatestPage(db, notebookId, limit = 50) {
  const res = await db.allDocs({
    startkey: prefix(notebookId) + '\uffff',
    endkey: prefix(notebookId),
    descending: true,
    include_docs: true,
    limit,
  });
  return res.rows.map(r => r.doc).reverse(); // oldest-first for display
}

export async function loadOlderPage(db, notebookId, beforeId, limit = 50) {
  const res = await db.allDocs({
    startkey: beforeId,
    endkey: prefix(notebookId),
    descending: true,
    skip: 1,
    include_docs: true,
    limit,
  });
  return res.rows.map(r => r.doc).reverse();
}
```

`<notebook-view>` loads the latest page on open (assumption: newest entries at the bottom, oldest-to-newest top-to-bottom, like a running log — see Section 16, item 2), and places an `IntersectionObserver` sentinel above the rendered window; when it's visible, `loadOlderPage` is called and results are prepended. The live changes feed only appends a new entry to the DOM if it's a genuinely new tail entry and the user is already scrolled near the bottom; otherwise show an "N new entries" pill rather than yanking the viewport. Edits to an already-rendered entry update that one element in place — keep a `Map<entryId, element>` so this is a direct lookup, not a scan-and-diff of the whole list.

**(b) Don't mount a live Tiptap instance per entry.** This is a gap neither earlier draft addressed, and it matters a lot for both performance and "polished" feel with potentially thousands of entries. `<log-entry>` has two render modes:
- **view** (default): the sanitized content is just set as static HTML inside a div, with a small edit affordance on hover.
- **edit** (only when the user explicitly clicks to edit *that specific entry*): swap in a real Tiptap instance, mounted in `firstUpdated()` (Lit's post-first-render hook, since the shadow DOM container needs to exist first), autofocus, debounced save per Section 8, swap back to view mode once the final debounced save resolves.

The only **permanently** mounted Tiptap instance is the one in `<entry-composer>`, used for writing new entries. This keeps the number of live ProseMirror instances bounded by what's actually being edited at any moment, not by how many entries exist.

For the bubble/format menu inside either editor: don't rely on Tiptap's default DOM-based bubble menu, since it assumes light-DOM access it won't have inside a shadow root. Listen to `selectionUpdate` and position a small floating toolbar manually.

**Author highlight:** thin colored left border + faint low-saturation background tint, sourced from `updatedByColor` (i.e. whoever touched it most recently — see Section 16, item 3) on the entry, not a live profile lookup. Hover/tap shows the full `attributionLabel()` string from Section 7.

---

## 12. Component Spec

| Component | Tag | Responsibility | Listens for / dispatches |
|---|---|---|---|
| App root | `<app-root>` | Identity gate, init db/sync, owns top-level routing between onboarding and the main shell | Listens for all bubbled events below, performs the actual `db.put`/`db.get` calls |
| Onboarding | `<onboarding-dialog>` | Collect name + email once, derive identity, write profile doc | dispatches `identity-confirmed { name, email }` |
| Sidebar | `<sidebar-nav>` | Lists notebooks (shared / private-unlocked / locked), triggers create & unlock flows | dispatches `notebook-selected`, `request-new-notebook`, `request-unlock` |
| New notebook | `<new-notebook-dialog>` | Visibility toggle, generates + displays the one-time private key | dispatches `notebook-created { visibility, title, key? }` |
| Unlock notebook | `<unlock-notebook-dialog>` | Paste a key to unlock a locked private notebook on this device | dispatches `notebook-unlocked { notebookId, key }` |
| Locked placeholder | `<locked-notebook>` | Generic placeholder for a private notebook this device has no key for | dispatches `request-unlock` |
| Notebook view | `<notebook-view>` | Per-notebook infinite-scroll container: pagination, virtualization, live-update routing (Section 11) | dispatches `entry-submit`, `entry-edit-submit` |
| Composer | `<entry-composer>` | The one persistently-mounted Tiptap instance, for new entries | dispatches `entry-submit { html }` |
| Entry block | `<log-entry>` | Renders one entry; static by default, lazy-mounts Tiptap on edit | dispatches `entry-edit-submit { id, html }` |

Children never write to PouchDB directly — every write flows up as a bubbled, composed custom event to `app-root`, which is the only place that touches `db.put`/`db.get`/`db.remove`.

---

## 13. Offline App Shell

PouchDB covers data. Without a service worker, the page itself won't load with no network — both are needed for "fully usable offline."

```js
// vite.config.js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SkunkWorks / Logs',
        short_name: 'SK Logs',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] },
    }),
  ],
});
```

---

## 14. Build Order

Work through these phases in order — each one is independently testable before moving on.

0. **Scaffold**: Vite project, install all dependencies from Section 2, empty `index.html` + `main.js` registering a blank `<app-root>`.
1. **Identity**: `identity.js`, `onboarding-dialog.js`, the `localStorage` gate in `app-root`.
2. **DB + sync + profile**: `db.js`, `sync.js`, write the `profile:<id>` doc on first onboarding.
3. **Notebooks**: `sidebar-nav.js` listing notebooks (shared / unlocked-private / locked), `new-notebook-dialog.js`, `crypto.js` + `vault.js` for private key gen/storage, title encryption.
4. **Static entry rendering**: `notebook-view.js` rendering a basic (non-virtualized) list, `log-entry.js` in view-only mode with highlight + hover attribution.
5. **Entry creation**: `entry-composer.js` with Tiptap, sanitize → encrypt-if-private → save, full event chain up to `app-root`.
6. **Entry editing**: click-to-edit lazy Tiptap mount in `log-entry.js`, debounce, `updatedBy`/`updatedAt` writes.
7. **Conflict resolution**: wire `resolveConflicts()` into the live changes listener.
8. **Virtualization**: ulid pagination, `IntersectionObserver` sentinels, live-feed-aware DOM patching, unread pill.
9. **Offline shell**: `vite-plugin-pwa` config, manifest, icons.
10. **Visual polish pass**: a separate, deliberately out-of-scope-here step — apply Material 3 defaults, grayscale palette, per-author accents, rounded corners. (Theming intentionally isn't specified in this document, per your request — but it's still a real remaining step, not something this plan assumes away.)
11. **Review pass**: work through Section 15 explicitly, line by line.

---

## 15. Review Checklist

- [ ] Every `encryptString` call uses a fresh random IV — none reused across calls with the same key.
- [ ] `sanitizeHtml()` runs both before every save and before every render, for shared *and* private entries.
- [ ] `sk_vault` and `sk_identity` never appear inside any object passed to `db.put`.
- [ ] No code path re-renders the full entry list on a single `changes()` event — only targeted DOM updates.
- [ ] Tiptap is only ever mounted for the composer and for an entry actively being edited — never one instance per rendered entry.
- [ ] `resolveConflicts()` uses the same comparison (`updatedAt`) on every client, and `conflicts: true` is actually passed to `changes()`.
- [ ] Attribution display matches the rule in Section 7 exactly, including the "same author, untouched" case.
- [ ] A locked private notebook never reveals its title or content anywhere in the DOM, console, or network tab beyond the encrypted blob and its own `_id`.
- [ ] CORS is configured on the CouchDB instance for the deployed origin; the UI reflects sync state (`active`/`paused`/error) rather than failing silently.

---

## 16. Open Assumptions — Confirm or Correct

1. **Private keys are per-notebook, not one universal key per person.** The data model (per-notebook `titleCipher`) only makes sense this way, and it's what lets a "locked notebook" placeholder work per-notebook rather than all-or-nothing. If you actually want one key that unlocks every private notebook you own at once, say so — it simplifies the vault but means losing that one key locks you out of everything at once, and there's no way to selectively unlock just one notebook on a new device.
2. **Entry display order**: oldest-to-newest top-to-bottom, composer pinned at the bottom, auto-scroll on new entries — like a terminal log or chat thread. Flip to newest-first if you'd rather read it like a changelog file.
3. **Author highlight color uses the most recent editor**, not the original creator — so an entry's visual color can change after someone else edits it, while the hover tooltip always shows the full creation + edit history regardless. If you'd rather the color stay fixed to whoever originally wrote it (edits just update the text shown on hover), that's a one-line change in `log-entry.js`.
4. **Locked notebooks are visible in the sidebar** (you can tell one exists, just not its name) rather than fully hidden — fully hiding existence would need per-user databases, which is more infrastructure than this app needs right now.

---

## 17. Things You're Still Missing

Beyond what's already designed above:

- **No export/backup.** If a private key is lost, that data is gone — and there's currently no way to export a notebook's contents at all, encrypted or not. Worth adding before this holds anything you actually care about keeping.
- **No search.** Once a notebook gets long, even a basic local full-text index over decrypted content will matter. Not hard to add later (index on write), but not in this plan.
- **No delete/retract mechanism.** A changelog usually still needs some way to retract a bad entry. Recommend a `retracted: true` + `retractedBy`/`retractedAt` flag rather than a hard delete — hide it in the UI, keep the document, avoid losing audit trail. Decide before you need it, not after.
- **No notification beyond the in-view unread pill.** Fine for now, but worth knowing it's not there.
- **Multi-tab same browser**: PouchDB itself handles this fine, and the conflict-resolution logic above actually covers most of the risk (two tabs editing the same entry just looks like two devices editing it). The one thing to watch for is two tabs both running independent live-changes listeners double-handling the same UI update — scope listeners carefully per open notebook rather than globally.
- **No per-user write ACLs.** Anyone with the shared sync credentials can write or delete anything in the shared database (they still can't decrypt private content). Acceptable for a small trusted team; revisit if the team or trust model grows.
