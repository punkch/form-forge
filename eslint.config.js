import neostandard, { plugins } from 'neostandard'
import pluginVue from 'eslint-plugin-vue'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.agent-os/**',
      '.claude/**',
    ],
  },
  ...neostandard({ ts: true }),
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: plugins['typescript-eslint'].parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      // TypeScript checks identifiers in <script setup lang="ts">; eslint's
      // no-undef has no browser globals configured here and double-reports.
      'no-undef': 'off',
    },
  },
  {
    rules: {
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      // `void somePromise` is the explicit fire-and-forget marker.
      'no-void': ['error', { allowAsStatement: true }],
      // XLSForm expressions use ${field} inside ordinary strings everywhere.
      'no-template-curly-in-string': 'off',
    },
  },
]
