// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
// import { nodePolyfills } from 'vite-plugin-node-polyfills';

import tailwindcss from '@tailwindcss/vite';

// import lit from '@astrojs/lit';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  output: "server",
  vite: {
    define: {
      global: 'globalThis', // Fixes PouchDB/EventEmitter global variables issues in Vite
    },
    plugins: [tailwindcss()]
  }
});