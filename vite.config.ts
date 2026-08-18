import { defineConfig } from 'vite';

export default defineConfig({
  // Relative URLs work for both local hosting and project GitHub Pages URLs.
  base: './',
  // These packages use runtime ESM/WASM loading. Keeping them out of Vite's
  // dependency pre-bundle avoids stale optimized chunks in Firefox.
  optimizeDeps: {
    exclude: ['videojs-libav', '@libav.js/variant-webcodecs', 'libavjs-webcodecs-bridge'],
  },
});
