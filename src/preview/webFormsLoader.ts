/**
 * Lazy, memoized loader for @getodk/web-forms (~3MB chunk with injected CSS).
 * Import side effects (style injection) happen on first preview use, not at
 * app startup. Never install its webFormsPlugin on the host app — PreviewHost
 * mounts OdkWebForm in an isolated child Vue app.
 */
let modulePromise: Promise<typeof import('@getodk/web-forms')> | null = null

export const loadWebForms = (): Promise<typeof import('@getodk/web-forms')> =>
  (modulePromise ??= import('@getodk/web-forms'))
