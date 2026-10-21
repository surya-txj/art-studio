import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the browser talks only to Vite (port 5173). Vite forwards
// /api and /images to the Express server, so the session cookie is same-origin
// and no CORS configuration is needed.
// Must match the server's PORT (default 4000).
const apiTarget = 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/images': apiTarget,
    },
  },
});
