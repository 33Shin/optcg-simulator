import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: {
      input: 'index.html',
    },
  },
  esbuild: {
    target: 'esnext',
  },
  server: {
    port: 8000,
    open: true,
  },
  optimizeDeps: {
    exclude: ['pixi.js'],
  },
});
