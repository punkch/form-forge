/**
 * Module declaration for @getodk/web-forms 1.0.0 — the published package
 * references dist/index.d.ts but does not ship it, so the surface we use is
 * declared here. Keep in sync with scripts/verify-webforms-bundle.mjs.
 */
declare module '@getodk/web-forms' {
  import type { DefineComponent, Plugin } from 'vue'

  export type FetchFormAttachment = (url: URL) => Promise<Response>

  export interface OdkWebFormProps {
    formXml: string
    fetchFormAttachment: FetchFormAttachment
    missingResourceBehavior?: 'ERROR' | 'BLANK'
    submissionMaxSize?: number
    attachmentMaxSize?: number
    editInstance?: unknown
  }

  export const OdkWebForm: DefineComponent<OdkWebFormProps>
  export const webFormsPlugin: Plugin
  export const POST_SUBMIT__NEW_INSTANCE: unique symbol
}
