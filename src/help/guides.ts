/**
 * Workflow-guide ordering and docs deep-links. The guide content itself is
 * the typed registry in `./content` (guideHelp) plus the i18n catalog
 * (src/i18n/locales/en/guides.json). Guide search happens in the drawer
 * against the i18n-resolved title/summary, so — unlike the question-type
 * registry — there is no plain-data matcher here.
 */
import { guideHelp, type GuideHelp, type GuideKey } from '@/help/content'

/** Drawer display order for the "Guides" section in list mode. */
export const GUIDE_KEYS: GuideKey[] = [
  'translations',
  'logic',
  'datasets',
  'entities',
  'central',
  'backup',
  'templates',
  'canvas',
  'autosave',
  'keyboard',
]

/**
 * "Read more" target for a guide — only guides with a docs.getodk.org
 * equivalent carry one; the app-specific guides return undefined.
 */
export const guideDocsUrl = (key: GuideKey): string | undefined =>
  (guideHelp as Record<GuideKey, GuideHelp>)[key].docsUrl
