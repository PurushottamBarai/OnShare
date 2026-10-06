import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    fs: {
      strict: false,
    },
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'packages/**/*.test.js',
      'apps/**/*.test.{js,jsx}',
      'tests/unit/**/*.test.{js,jsx}',
    ],
  },
});
