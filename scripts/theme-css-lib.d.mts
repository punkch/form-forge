export const DARK_SELECTOR: string
export function generateThemeDarkCss (): string
export function generateAccentsCss (): string
export function accentPrimary500 (): Record<string, string>
export const ACCENT_GEN: ReadonlyArray<{ id: string, anchor: string, contrast?: string }>
export function relativeLuminance (hex: string): number
export function contrastRatio (hexA: string, hexB: string): number
export function generateAccentContrastCss (): string
export function accentContrastSteps (): Record<string, Record<string, number>>
