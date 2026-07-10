import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

import pkg from './package.json'

export default defineConfig({
  plugins: [vue()],
  define: {
    // Same build-time constant Vite injects (src/types/globals.d.ts).
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/core/**/*.spec.ts',
            'src/persistence/**/*.spec.ts',
            'src/preview/**/*.spec.ts',
            'src/stores/**/*.spec.ts',
            'tests/unit/**/*.spec.ts',
            'tests/golden/**/*.spec.ts',
          ],
          setupFiles: ['tests/setup/unit.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'happy-dom',
          include: [
            'tests/component/**/*.spec.ts',
          ],
          setupFiles: ['tests/setup/component.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/types/**', 'src/**/*.d.ts'],
      // Regression floors pinned slightly under achieved coverage
      // (2026-07-09: core 86-98% stmts, stores 83%). Raise as coverage grows.
      thresholds: {
        'src/core/**': { statements: 86, branches: 78, lines: 88 },
        'src/stores/**': { statements: 80, lines: 85 },
        'src/persistence/**': { statements: 90, lines: 92 },
      },
    },
  },
})
