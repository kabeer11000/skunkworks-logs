SkunkWorks Logs is a local-first engineering log and changelog tool. Every drain is a running log of timestamped entries you can write to from anywhere, offline or online, with changes syncing automatically once you're back online. Drains can be private, just for you, or shared with specific people by email invite, and you can select any text in an entry to leave a comment on it, like Google Docs. Access is enforced by the database itself rather than just the app, since each drain lives in its own CouchDB database with real membership rules, so only invited members can read or write it. It's built with Astro, React, Tiptap, PouchDB, and CouchDB.

To run it locally, install dependencies with npm install, set the VITE_COUCHDB_URL environment variable to the CouchDB database URL the app should sync to and COUCHDB_ADMIN_URL to an admin credential used only by server routes to create accounts and drains, kept server-side and never exposed to the client, then start the dev server with npm run dev. To build for production, run npm run build, which outputs to the dist folder, and the same two environment variables need to be set wherever it's deployed.

Regards,
Kabeer
