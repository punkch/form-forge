/**
 * Build-time constants injected via `define` in vite.config.ts and
 * vitest.config.ts. Guard reads with `typeof __APP_VERSION__ === 'string'`
 * so code still runs in environments without the define.
 */
declare const __APP_VERSION__: string
