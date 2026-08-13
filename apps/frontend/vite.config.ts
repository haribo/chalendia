import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
// From vitest so the test block is typed; it wraps vite's own defineConfig.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  // The .env lives at the repository root, shared with the backend.
  envDir: '../..',
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
