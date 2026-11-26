import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Only the framework is hand-chunked (long-term cacheable). jsPDF, Monaco loader, sql.js, mingo and
// tree-sitter are reached exclusively through dynamic imports (lazy pages / click handlers), so the
// bundler already emits them as separate lazy chunks. Forcing them into manual chunks made the entry
// chunk import jsPDF (~780 kB) eagerly, so we deliberately do not.
function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\/]/.test(id)) return 'react-vendor';
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 900,
    cssCodeSplit: true,
    rollupOptions: { output: { manualChunks } },
  },
});
