import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@onshare/protocol': path.resolve(__dirname, '../../packages/protocol/src/index.js'),
    },
    preserveSymlinks: true,
  },
  plugins: [react()],
  server: {
    port: 3000,
    allowedHosts: true,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://www.highperformanceformat.com https://*.highperformanceformat.com https://bauval.org https://*.adsterra.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss: http: https:; img-src 'self' data: blob: https://pagead2.googlesyndication.com https://www.highperformanceformat.com https://*.highperformanceformat.com https://bauval.org https://*.adsterra.com; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://googleads.g.doubleclick.net https://www.highperformanceformat.com https://*.highperformanceformat.com https://bauval.org https://*.adsterra.com;",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
    proxy: {
      '/ws': {
        target: 'http://localhost:8787',
        ws: true,
      },
    },
  },
  build: {
    target: 'es2022',
  },
});
