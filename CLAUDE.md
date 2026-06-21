# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SkunkWorks / Logs** is a local-first, offline-capable changelog notebook app. It uses Astro (SSR mode) as the framework, with React components for interactive UI, and persists data locally via PouchDB with optional CouchDB sync.

**Terminology**: The UI refers to notebooks as "drains," but the underlying data model still uses `notebook:` prefixes for document IDs.

## Tech Stack

| Purpose | Library |
|---|---|
| Framework | Astro 6 (`output: "server"`) |
| UI Components | React + @material/web v2 |
| Styling | Tailwind CSS v4 |
| State | Nanostores (`@nanostores/react`) |
| Rich Text | Tiptap (`@tiptap/react`) |
| Local DB | PouchDB |
| Encryption | Web Crypto API (AES-GCM) |
| Sortable IDs | ULID |

## Commands

```bash
npm run dev      # Start dev server at localhost:4321
npm run build    # Build production site to ./dist/
npm run preview  # Preview production build locally
npm run astro -- <cmd>  # Run Astro CLI commands
```

## Architecture

### Routing
- `/` — Dashboard (lists drains, requires identity)
- `/drains/[drain]` — Individual drain view with Tiptap editor

### Pages
- `src/pages/index.astro` — Main dashboard, shows `<Navigation>` + welcome screen
- `src/pages/drains/[drain].astro` — Per-drain editor view, uses `<Editor client:only="react" />`

### Components
- `src/components/navigation.astro` — Sidebar with drain list, triggers drain creation dialog
- `src/components/onboarding.astro` — Identity setup (name/email) shown if no `sk_identity` cookie
- `src/components/Editor/index.tsx` — React Tiptap editor for drain content
- `src/components/new-drain-dialog.ts` — Custom element (`<new-drain-dialog>`) for creating drains
- `src/components/drain-sidebar-item.js` — Custom element for sidebar drain list items

### Services
- `src/services/db.ts` — PouchDB instance (`skunkworks-logs`)
- `src/services/identity.ts` — Identity derivation from email, cookie storage, nanostore `$identity`
- `src/services/crypto.js` — AES-GCM key generation, encrypt/decrypt
- `src/services/vault.js` — LocalStorage vault for private notebook keys (`sk_vault`)
- `src/services/sanitize.js` — DOMPurify HTML sanitization
- `src/services/sync.js` — PouchDB → CouchDB sync via `VITE_COUCHDB_URL`

### Helpers
- `src/helpers/drains.ts` — Nanostore `$drains` and `populateDrains()` to load notebooks

### Identity Model
Identity is stored in a cookie (`sk_identity`), not localStorage. On first visit, onboarding collects name + email, derives a `publicUserId` (SHA-256 hash prefix) and color, then writes a `profile:<publicUserId>` doc to PouchDB.

### Data Model
- `notebook:<ulid>` — Notebook metadata (visibility: shared/private, title, titleCipher)
- `entry:<notebookId>:<ulid>` — Entry blocks with denormalized author info
- `profile:<publicUserId>` — Public profile for hover attribution

### Private Notebooks
- Each private notebook has its own AES-256-GCM key
- Key is generated at creation, shown once, stored in localStorage vault (`sk_vault`)
- Title is encrypted (`titleCipher`) when private; `title` is `null`
- Loss of key = permanent data loss (no recovery)

### Sync
- Reads `VITE_COUCHDB_URL` env var (defaults to `http://localhost:5984/main`)
- Uses PouchDB live sync with retry
- Vault and identity keys never leave the device

## Key Implementation Notes

1. **SSR + Client State**: Identity lives in cookies (readable on server) so pages can conditionally render onboarding vs. dashboard without flash-of-wrong-content
2. **Material Web**: Imported as JS modules in component `<script>` tags, not as npm package imports in React
3. **Custom Elements**: `new-drain-dialog` and `drain-sidebar-item` use shadow DOM with manual DOM rendering (not Lit, despite Lit being installed)
4. **Tiptap Editor**: Only mounted in `<Editor>` component (`client:only="react"`), not per-entry
5. **No Conflict Resolution Yet**: PLAN.md specifies `resolveConflicts()` but current code doesn't implement it
6. **No Entry Editing Yet**: The Tiptap editor loads existing content but save/discard flows are not fully wired

## Environment Variables

```bash
VITE_COUCHDB_URL=http://user:pass@host:5984/dbname  # CouchDB sync target
```
