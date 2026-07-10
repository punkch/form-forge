import vueI18n from '@intlify/eslint-plugin-vue-i18n'
import neostandard, { plugins } from 'neostandard'
import pluginVue from 'eslint-plugin-vue'

// UI message catalog: one JSON file per namespace under a per-locale dir,
// each file's single top-level key being its namespace (see
// src/i18n/locales/en/index.ts). `localeKey: 'path'` derives the locale from
// the directory name; the plugin merges all files of a locale for key lookup.
const vueI18nSettings = {
  'vue-i18n': {
    localeDir: {
      pattern: 'src/i18n/locales/*/*.json',
      localeKey: 'path',
      localePattern: /^.*\/(?<locale>[A-Za-z0-9-_]+)\/[^/\\]+\.json$/,
    },
    messageSyntaxVersion: '^11.0.0',
  },
}

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
    // Bad t()/$t() keys are build breakers anywhere UI code calls i18n.
    files: ['src/**/*.vue', 'src/**/*.ts'],
    plugins: { '@intlify/vue-i18n': vueI18n },
    settings: vueI18nSettings,
    rules: {
      '@intlify/vue-i18n/no-missing-keys': 'error',
    },
  },
  {
    // Hardcoded UI strings surface as warnings until extraction lands
    // area-by-area; scoped so core/stores/tests stay quiet.
    files: ['src/components/**/*.vue', 'src/views/**/*.vue'],
    plugins: { '@intlify/vue-i18n': vueI18n },
    settings: vueI18nSettings,
    rules: {
      // Pure symbols stay in templates: separators (·, /), the required
      // marker (*) and rendered ${field} syntax are not translatable text.
      '@intlify/vue-i18n/no-raw-text': ['warn', { ignorePattern: '^[·/*${}\\s]+$' }],
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
