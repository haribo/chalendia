import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
// From vitest so the test block is typed; it wraps vite's own defineConfig.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  // The .env lives at the repository root, shared with the backend.
  envDir: '../..',
  server: {
    proxy: {
      // In production one process serves both on one origin. Proxying here
      // gives development the same shape — no cross-origin, so no cookie that
      // travels in one setup and not the other.
      '/api': {
        target: process.env.CHALENDIA_DEV_API_URL ?? 'http://127.0.0.1:8090',
        changeOrigin: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    // Without a real origin, jsdom serves an opaque one and defines no
    // localStorage at all — every preference test would fail on the
    // environment rather than on the code.
    environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
})
