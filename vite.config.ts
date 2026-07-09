import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // @getodk/web-forms is a ~3MB chunk on its own; it is lazy-imported by the
    // preview and must not be inlined into the entry chunk.
    rollupOptions: {
      output: {
        manualChunks (id) {
          if (id.includes('@getodk')) return 'odk-web-forms'
        },
      },
    },
  },
})
