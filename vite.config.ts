import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import pkg from './package.json'

export default defineConfig({
  plugins: [vue()],
  // vue-i18n esm-bundler feature flags: Composition API only, no devtools
  // payload, keep the runtime message compiler (catalog is plain JSON).
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_DROP_MESSAGE_COMPILER__: false,
    // Stamped into workspace archive manifests (src/types/globals.d.ts).
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
