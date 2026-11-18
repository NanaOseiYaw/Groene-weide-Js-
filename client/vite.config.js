// Vite: the development server and build tool for the Vue frontend.
//   npm run dev    → http://localhost:5173, reloads when you save a file (.vue, .js or .scss)
//   npm run build  → client/dist, which the Express server serves in production
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    // In development the API runs separately on port 3000. The browser only talks to 5173;
    // Vite passes /api and /uploads on, so cookies and URLs work exactly as in production.
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
