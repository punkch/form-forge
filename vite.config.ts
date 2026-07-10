import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import pkg from './package.json'

// Deploy-time base path (e.g. '/form-forge/' on project pages). The manifest
// uses relative start_url/scope and relative icon paths so the PWA follows
// whatever base the deployment sets.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      // 'prompt': the SW waits for updateSW() instead of auto-activating.
      // src/pwa/registerSW.ts layers the hybrid policy (auto-reload when
      // safe, sticky toast mid-edit) on top of this plumbing.
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
        // The odk-web-forms chunk is ~5 MB raw; offline preview is the whole
        // point, so raise workbox's 2 MB default to precache it.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Form Forge for ODK',
        short_name: 'Form Forge',
        description: pkg.description,
        display: 'standalone',
        theme_color: '#3e9fcc',
        background_color: '#ffffff',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
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
