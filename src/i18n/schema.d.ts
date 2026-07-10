/**
 * Augments vue-i18n's global message type with the English catalog schema so
 * bad keys fail vue-tsc everywhere `t()` / `$t()` is used — including in
 * component templates.
 */
import type { MessageSchema } from './index'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
