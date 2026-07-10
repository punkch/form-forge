/**
 * Registry of the bundled starter templates. The template documents live in
 * ./<slug>.json (generated artifacts — see scripts/make-templates.ts) and are
 * loaded lazily so each stays its own chunk. Gallery metadata (title,
 * description) goes through the UI catalog; the template CONTENT itself is
 * bilingual EN+FR inside the JSON.
 */
import { migrateDoc } from '@/core/model/migrate'
import type { FormDocument } from '@/core/model/types'
import type { MessageKey } from '@/i18n'

export interface BundledTemplate {
  id: string
  titleKey: MessageKey
  descriptionKey: MessageKey
  tags: string[]
  questionCount: number
  /** First question labels (English) — the gallery card's text preview. */
  preview: string[]
  load: () => Promise<FormDocument>
}

/** migrateDoc-guarded JSON import: a stale/corrupt artifact throws, never
 * leaks a malformed document into the editor. */
const loadTemplate = async (importJson: () => Promise<{ default: unknown }>): Promise<FormDocument> => {
  const { doc, issues } = migrateDoc((await importJson()).default)
  if (doc === null) {
    throw new Error(`Bundled template failed to load: ${issues.map((i) => i.message).join('; ')}`)
  }
  return doc
}

export const bundledTemplates: BundledTemplate[] = [
  {
    id: 'household-survey',
    titleKey: 'library.templates.householdSurvey.title',
    descriptionKey: 'library.templates.householdSurvey.description',
    tags: ['survey', 'household', 'repeat'],
    questionCount: 13,
    preview: [
      'Household survey — one interview per household with the head of household or another adult member.',
      'Date of interview',
      'Region',
      'Village or neighbourhood',
      'Household location',
    ],
    load: () => loadTemplate(() => import('./household-survey.json')),
  },
  {
    id: 'individual-registration',
    titleKey: 'library.templates.individualRegistration.title',
    descriptionKey: 'library.templates.individualRegistration.description',
    tags: ['registration', 'case-management'],
    questionCount: 11,
    preview: [
      'Individual registration — record one person per submission.',
      'Registration date',
      'Full name',
      'Sex',
      'Date of birth',
    ],
    load: () => loadTemplate(() => import('./individual-registration.json')),
  },
  {
    id: 'site-monitoring-visit',
    titleKey: 'library.templates.siteMonitoringVisit.title',
    descriptionKey: 'library.templates.siteMonitoringVisit.description',
    tags: ['monitoring', 'checklist'],
    questionCount: 13,
    preview: [
      'Site monitoring visit — complete one checklist per site visit.',
      'Date of visit',
      'Site name',
      'Site code',
      'Site location',
    ],
    load: () => loadTemplate(() => import('./site-monitoring-visit.json')),
  },
  {
    id: 'feedback-satisfaction',
    titleKey: 'library.templates.feedbackSatisfaction.title',
    descriptionKey: 'library.templates.feedbackSatisfaction.description',
    tags: ['feedback', 'satisfaction'],
    questionCount: 10,
    preview: [
      'Feedback survey — responses are anonymous and take about two minutes.',
      'Date',
      'Which service did you use today?',
      'Please specify the service',
      'Overall, how satisfied are you with the service?',
    ],
    load: () => loadTemplate(() => import('./feedback-satisfaction.json')),
  },
]
