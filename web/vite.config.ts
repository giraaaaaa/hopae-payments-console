/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The dev server proxies /api to the mock server so the app needs no base-URL
// config and no CORS handling in the browser.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  // `vite preview` (the built bundle) needs the same proxy — used for
  // Lighthouse runs against production output.
  preview: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
