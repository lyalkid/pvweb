import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base подставляется при сборке: на GitHub Pages сайт живёт в подкаталоге /<repo>/.
// Workflow передаёт его флагом --base, локально остаётся '/'.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'phylo-tree-lib': fileURLToPath(
        new URL('./packages/phylo-tree-lib/src/index.ts', import.meta.url)
      ),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
