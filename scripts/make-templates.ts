/**
 * Generator for the bundled starter templates in src/templates/*.json.
 *
 * The checked-in artifacts are the JSON files; this script is how they are
 * (re)generated. It builds each template programmatically with the model
 * factory/ops APIs, asserts it is valid (0 validation errors, 0 serializer
 * errors) and — deliberately — produces byte-identical output on every run
 * (deterministic node ids, fixed version stamp), so regeneration diffs stay
 * readable.
 *
 * Regenerate with:
 *   REGENERATE_TEMPLATES=1 pnpm vitest run tests/unit/templates-registry.spec.ts
 *
 * (There is no tsx/ts-node in this repo; the registry spec imports this
 * module, verifies the checked-in JSON still matches what it builds, and
 * rewrites the files when the env var is set.)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createNode, newDocument } from '../src/core/model/factory'
import { insertNode, visit } from '../src/core/model/ops'
import type {
  ContainerNode,
  FormDocument,
  LocalizedText,
  QuestionNode,
} from '../src/core/model/types'
import { validateDocument } from '../src/core/validate'
import { serializeXForm } from '../src/core/xform/serializer'

const EN = 'English (en)'
const FR = 'French (fr)'

/** Bilingual text pair — every user-visible template string has both. */
type Bi = [en: string, fr: string]

const L = ([en, fr]: Bi): LocalizedText => ({ [EN]: en, [FR]: fr })

const baseDoc = (title: string, formId: string): FormDocument => {
  const doc = newDocument(title)
  doc.settings.formId = formId
  // Fixed stamp for determinism; instantiateTemplate mints the real version.
  doc.settings.version = '1'
  doc.settings.defaultLanguage = EN
  doc.languages = [EN, FR]
  return doc
}

const addList = (doc: FormDocument, name: string, choices: Array<[value: string, en: string, fr: string]>): void => {
  doc.choiceLists[name] = {
    name,
    choices: choices.map(([value, en, fr]) => ({ name: value, label: L([en, fr]) })),
  }
}

interface QuestionOpts {
  hint?: Bi
  required?: boolean
  listRef?: string
  relevant?: string
  constraint?: string
  constraintMessage?: Bi
  appearance?: string
}

const question = (
  doc: FormDocument,
  parentId: string | null,
  type: string,
  name: string,
  label: Bi,
  opts: QuestionOpts = {}
): QuestionNode => {
  const node = createNode(doc, type, { listRef: opts.listRef }) as QuestionNode
  node.name = name
  node.label = L(label)
  if (opts.hint !== undefined) node.hint = L(opts.hint)
  if (opts.required === true) node.bind.required = 'true()'
  if (opts.relevant !== undefined) node.bind.relevant = opts.relevant
  if (opts.constraint !== undefined) node.bind.constraint = opts.constraint
  if (opts.constraintMessage !== undefined) node.bind.constraintMessage = L(opts.constraintMessage)
  if (opts.appearance !== undefined) node.body.appearance = opts.appearance
  insertNode(doc, node, parentId)
  return node
}

const container = (
  doc: FormDocument,
  parentId: string | null,
  kind: 'group' | 'repeat',
  name: string,
  label: Bi
): ContainerNode => {
  const node = createNode(doc, kind) as ContainerNode
  node.name = name
  node.label = L(label)
  insertNode(doc, node, parentId)
  return node
}

/** Deterministic ids so regeneration never produces a spurious diff. */
const stampIds = (doc: FormDocument, formId: string): void => {
  let i = 0
  visit(doc.children, (node) => {
    node.id = `${formId}_n${++i}`
    return undefined
  })
}

const householdSurvey = (): FormDocument => {
  const doc = baseDoc('Household survey', 'household_survey')
  addList(doc, 'region', [
    ['north', 'North', 'Nord'],
    ['south', 'South', 'Sud'],
    ['east', 'East', 'Est'],
    ['west', 'West', 'Ouest'],
  ])
  addList(doc, 'yes_no', [
    ['yes', 'Yes', 'Oui'],
    ['no', 'No', 'Non'],
  ])
  addList(doc, 'sex', [
    ['female', 'Female', 'Féminin'],
    ['male', 'Male', 'Masculin'],
    ['prefer_not_to_say', 'Prefer not to say', 'Préfère ne pas répondre'],
  ])
  addList(doc, 'water_source', [
    ['piped', 'Piped water', 'Eau courante'],
    ['well', 'Well or borehole', 'Puits ou forage'],
    ['surface', 'Surface water', 'Eau de surface'],
    ['bottled', 'Bottled water', 'Eau en bouteille'],
  ])

  question(doc, null, 'note', 'intro',
    ['Household survey — one interview per household with the head of household or another adult member.',
      'Enquête ménage — un entretien par ménage avec le chef de ménage ou un autre membre adulte.'])
  question(doc, null, 'date', 'interview_date', ['Date of interview', "Date de l'entretien"], { required: true })
  question(doc, null, 'select_one', 'region', ['Region', 'Région'], { required: true, listRef: 'region' })
  question(doc, null, 'text', 'village', ['Village or neighbourhood', 'Village ou quartier'])
  question(doc, null, 'geopoint', 'household_location', ['Household location', 'Localisation du ménage'],
    { hint: ['Record the GPS point at the dwelling entrance.', "Enregistrez le point GPS à l'entrée du logement."] })
  question(doc, null, 'text', 'head_name', ['Name of the head of household', 'Nom du chef de ménage'], { required: true })
  question(doc, null, 'integer', 'household_size', ['How many people live in this household?', 'Combien de personnes vivent dans ce ménage ?'], {
    required: true,
    constraint: '. >= 1 and . <= 50',
    constraintMessage: ['Household size must be between 1 and 50.', 'La taille du ménage doit être comprise entre 1 et 50.'],
  })

  const members = container(doc, null, 'repeat', 'household_member', ['Household member', 'Membre du ménage'])
  question(doc, members.id, 'text', 'member_name', ['Member name', 'Nom du membre'], { required: true })
  question(doc, members.id, 'integer', 'member_age', ['Age (years)', 'Âge (années)'], {
    constraint: '. >= 0 and . <= 120',
    constraintMessage: ['Age must be between 0 and 120.', "L'âge doit être compris entre 0 et 120."],
  })
  question(doc, members.id, 'select_one', 'member_sex', ['Sex', 'Sexe'], { listRef: 'sex' })

  question(doc, null, 'select_one', 'water_source', ['Main source of drinking water', "Principale source d'eau potable"], { listRef: 'water_source' })
  question(doc, null, 'select_one', 'owns_dwelling', ['Does the household own this dwelling?', 'Le ménage est-il propriétaire de ce logement ?'], { listRef: 'yes_no' })
  question(doc, null, 'text', 'comments', ['Comments', 'Commentaires'], { appearance: 'multiline' })
  return doc
}

const individualRegistration = (): FormDocument => {
  const doc = baseDoc('Individual registration', 'individual_registration')
  addList(doc, 'sex', [
    ['female', 'Female', 'Féminin'],
    ['male', 'Male', 'Masculin'],
    ['prefer_not_to_say', 'Prefer not to say', 'Préfère ne pas répondre'],
  ])
  addList(doc, 'marital_status', [
    ['single', 'Single', 'Célibataire'],
    ['married', 'Married', 'Marié(e)'],
    ['divorced', 'Divorced', 'Divorcé(e)'],
    ['widowed', 'Widowed', 'Veuf/veuve'],
  ])
  addList(doc, 'yes_no', [
    ['yes', 'Yes', 'Oui'],
    ['no', 'No', 'Non'],
  ])

  question(doc, null, 'note', 'intro',
    ['Individual registration — record one person per submission.',
      'Enregistrement individuel — une personne par soumission.'])
  question(doc, null, 'date', 'registration_date', ['Registration date', "Date d'enregistrement"], { required: true })
  question(doc, null, 'text', 'full_name', ['Full name', 'Nom complet'], { required: true })
  question(doc, null, 'select_one', 'sex', ['Sex', 'Sexe'], { listRef: 'sex' })
  question(doc, null, 'date', 'date_of_birth', ['Date of birth', 'Date de naissance'], {
    constraint: '. <= today()',
    constraintMessage: ['The date of birth cannot be in the future.', 'La date de naissance ne peut pas être dans le futur.'],
  })
  question(doc, null, 'text', 'nationality', ['Nationality', 'Nationalité'])
  question(doc, null, 'text', 'id_number', ['ID document number', "Numéro de pièce d'identité"],
    { hint: ['Leave blank if no document is available.', "Laissez vide si aucun document n'est disponible."] })
  question(doc, null, 'text', 'phone_number', ['Phone number', 'Numéro de téléphone'], { appearance: 'numbers' })
  question(doc, null, 'select_one', 'marital_status', ['Marital status', 'État civil'], { listRef: 'marital_status' })
  question(doc, null, 'text', 'occupation', ['Occupation', 'Profession'])
  question(doc, null, 'select_one', 'consent', ['Does the person consent to the processing of this data?', 'La personne consent-elle au traitement de ces données ?'], { required: true, listRef: 'yes_no' })
  return doc
}

const siteMonitoringVisit = (): FormDocument => {
  const doc = baseDoc('Site monitoring visit', 'site_monitoring_visit')
  addList(doc, 'visit_type', [
    ['scheduled', 'Scheduled visit', 'Visite planifiée'],
    ['follow_up', 'Follow-up visit', 'Visite de suivi'],
    ['incident', 'Incident response', 'Réponse à un incident'],
  ])
  addList(doc, 'yes_no', [
    ['yes', 'Yes', 'Oui'],
    ['no', 'No', 'Non'],
  ])

  question(doc, null, 'note', 'intro',
    ['Site monitoring visit — complete one checklist per site visit.',
      'Visite de suivi de site — remplissez une liste de contrôle par visite.'])
  question(doc, null, 'date', 'visit_date', ['Date of visit', 'Date de la visite'], { required: true })
  question(doc, null, 'text', 'site_name', ['Site name', 'Nom du site'], { required: true })
  question(doc, null, 'text', 'site_code', ['Site code', 'Code du site'],
    { hint: ['As printed on the site signboard.', "Tel qu'indiqué sur le panneau du site."] })
  question(doc, null, 'geopoint', 'site_location', ['Site location', 'Localisation du site'])
  question(doc, null, 'select_one', 'visit_type', ['Type of visit', 'Type de visite'], { required: true, listRef: 'visit_type' })
  question(doc, null, 'integer', 'staff_present', ['Number of staff present', 'Nombre de membres du personnel présents'], {
    constraint: '. >= 0',
    constraintMessage: ['The number of staff cannot be negative.', 'Le nombre de membres du personnel ne peut pas être négatif.'],
  })
  question(doc, null, 'select_one', 'facilities_clean', ['Are the facilities clean?', 'Les installations sont-elles propres ?'], { listRef: 'yes_no' })
  question(doc, null, 'select_one', 'equipment_functional', ['Is the equipment functional?', "L'équipement est-il fonctionnel ?"], { listRef: 'yes_no' })
  question(doc, null, 'select_one', 'issues_found', ['Were any issues found?', 'Des problèmes ont-ils été constatés ?'], { required: true, listRef: 'yes_no' })
  question(doc, null, 'text', 'issues_description', ['Describe the issues found', 'Décrivez les problèmes constatés'], {
    relevant: "${issues_found} = 'yes'",
    appearance: 'multiline',
  })
  question(doc, null, 'select_one', 'follow_up_required', ['Is a follow-up visit required?', 'Une visite de suivi est-elle nécessaire ?'], { listRef: 'yes_no' })
  question(doc, null, 'date', 'next_visit_date', ['Planned date of the next visit', 'Date prévue de la prochaine visite'], {
    relevant: "${follow_up_required} = 'yes'",
  })
  return doc
}

const feedbackSatisfaction = (): FormDocument => {
  const doc = baseDoc('Feedback and satisfaction', 'feedback_satisfaction')
  addList(doc, 'service', [
    ['registration', 'Registration', 'Enregistrement'],
    ['distribution', 'Distribution', 'Distribution'],
    ['health', 'Health services', 'Services de santé'],
    ['other', 'Other', 'Autre'],
  ])
  addList(doc, 'satisfaction', [
    ['very_satisfied', 'Very satisfied', 'Très satisfait(e)'],
    ['satisfied', 'Satisfied', 'Satisfait(e)'],
    ['neutral', 'Neutral', 'Neutre'],
    ['dissatisfied', 'Dissatisfied', 'Insatisfait(e)'],
    ['very_dissatisfied', 'Very dissatisfied', 'Très insatisfait(e)'],
  ])
  addList(doc, 'yes_no', [
    ['yes', 'Yes', 'Oui'],
    ['no', 'No', 'Non'],
  ])

  question(doc, null, 'note', 'intro',
    ['Feedback survey — responses are anonymous and take about two minutes.',
      'Enquête de satisfaction — les réponses sont anonymes et prennent environ deux minutes.'])
  question(doc, null, 'date', 'feedback_date', ['Date', 'Date'], { required: true })
  question(doc, null, 'select_one', 'service_used', ['Which service did you use today?', "Quel service avez-vous utilisé aujourd'hui ?"], { required: true, listRef: 'service' })
  question(doc, null, 'text', 'service_other', ['Please specify the service', 'Veuillez préciser le service'], {
    relevant: "${service_used} = 'other'",
  })
  question(doc, null, 'select_one', 'overall_satisfaction', ['Overall, how satisfied are you with the service?', 'Dans l’ensemble, êtes-vous satisfait(e) du service ?'], { required: true, listRef: 'satisfaction' })
  question(doc, null, 'select_one', 'staff_courtesy', ['How satisfied are you with the courtesy of the staff?', 'Êtes-vous satisfait(e) de la courtoisie du personnel ?'], { listRef: 'satisfaction' })
  question(doc, null, 'integer', 'waiting_time_minutes', ['How long did you wait (minutes)?', 'Combien de temps avez-vous attendu (minutes) ?'], {
    constraint: '. >= 0',
    constraintMessage: ['The waiting time cannot be negative.', "Le temps d'attente ne peut pas être négatif."],
  })
  question(doc, null, 'text', 'dissatisfaction_reason', ['What was the main reason for your dissatisfaction?', 'Quelle était la principale raison de votre insatisfaction ?'], {
    relevant: "${overall_satisfaction} = 'dissatisfied' or ${overall_satisfaction} = 'very_dissatisfied'",
    appearance: 'multiline',
  })
  question(doc, null, 'select_one', 'would_recommend', ['Would you recommend this service to others?', 'Recommanderiez-vous ce service à d’autres personnes ?'], { listRef: 'yes_no' })
  question(doc, null, 'text', 'suggestions', ['Suggestions for improvement', "Suggestions d'amélioration"], { appearance: 'multiline' })
  return doc
}

export interface BuiltTemplate {
  slug: string
  doc: FormDocument
}

const BUILDERS: Array<[slug: string, build: () => FormDocument]> = [
  ['household-survey', householdSurvey],
  ['individual-registration', individualRegistration],
  ['site-monitoring-visit', siteMonitoringVisit],
  ['feedback-satisfaction', feedbackSatisfaction],
]

/** Build all templates, asserting each is valid and serializable. */
export const buildTemplates = (): BuiltTemplate[] =>
  BUILDERS.map(([slug, build]) => {
    const doc = build()
    stampIds(doc, doc.settings.formId ?? slug)
    const errors = validateDocument(doc).filter((i) => i.severity === 'error')
    if (errors.length > 0) {
      throw new Error(`Template ${slug} has validation errors:\n${errors.map((i) => `${i.code}: ${i.message}`).join('\n')}`)
    }
    const serializeErrors = serializeXForm(doc).issues.filter((i) => i.severity === 'error')
    if (serializeErrors.length > 0) {
      throw new Error(`Template ${slug} has serializer errors:\n${serializeErrors.map((i) => `${i.code}: ${i.message}`).join('\n')}`)
    }
    return { slug, doc }
  })

export const templateJson = (doc: FormDocument): string =>
  `${JSON.stringify(doc, null, 2)}\n`

/** Write (or rewrite) src/templates/<slug>.json. */
export const writeTemplates = (dir: string): void => {
  mkdirSync(dir, { recursive: true })
  for (const { slug, doc } of buildTemplates()) {
    writeFileSync(join(dir, `${slug}.json`), templateJson(doc))
  }
}
