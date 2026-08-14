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
    define: {
      global: 'globalThis', // Fixes PouchDB/EventEmitter global variables issues in Vite
    },
    plugins: [tailwindcss()]
  }
});
