// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel'
// import { nodePolyfills } from 'vite-plugin-node-polyfills';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  adapter: vercel(),
  output: "server",
  vite: {
    // Astro only exposes PUBLIC_-prefixed vars to client bundles by default,
    // overriding Vite's own VITE_ convention (astro/dist/core/create-vite.js).
    // VITE_COUCHDB_URL never actually reached the client without this —
    // it silently fell back to sync.js's old hardcoded localhost default,
    // undetected in dev because that default happened to match a real local
    // CouchDB instance.
    envPrefix: ['PUBLIC_', 'VITE_'],
    define: {
      global: 'globalThis', // Fixes PouchDB/EventEmitter global variables issues in Vite
    },
    plugins: [tailwindcss()]
  }
});
