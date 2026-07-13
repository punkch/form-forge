export function findWebFormsDist (): { dir: string, pkg: Record<string, any> }
export function readBundleSources (): string
export function extractOdkTokens (source: string): Map<string, string>
export function extractPrimaryScale (source: string): Record<string, string> | null
export function extractDarkModeSelector (source: string): string | null
export function bundledPrimeVueVersions (): {
  primevue?: string
  themes?: string
  primeflex?: string
  webForms?: string
}
export function parseTokensCss (cssText: string): Map<string, string>
