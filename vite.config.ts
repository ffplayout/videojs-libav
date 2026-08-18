import { defineConfig } from 'vite';

export default defineConfig({
  // Keep every built asset relative to index.html. This works locally and on
  // the GitHub project page at /videojs-libav/ without hard-coding its name.
  base: './',
  // These packages use runtime ESM/WASM loading. Keeping them out of Vite's
  // dependency pre-bundle avoids stale optimized chunks in Firefox.
  optimizeDeps: {
    exclude: ['videojs-libav', '@libav.js/variant-webcodecs', 'libavjs-webcodecs-bridge'],
  },
});
