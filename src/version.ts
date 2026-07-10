/** Build-time app version (src/types/globals.d.ts) with a dev fallback. */
export const appVersion = (): string =>
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '1.0.0-dev'
