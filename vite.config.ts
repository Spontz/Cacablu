import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  assetsInclude: ['**/*.wasm'],
});
