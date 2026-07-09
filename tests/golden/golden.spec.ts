/**
 * Golden parity tests: our serializer's output must be semantically equal
 * (canonicalized) to pyxform 4.5.0's for each fixture in src/. The
 * FormDocument builders below mirror the XLSForms in scripts/make-goldens.py.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { serializeXForm } from '../../src/core/xform/serializer'
import type { FormDocument } from '../../src/core/model/types'
import { canonicalizeXForm } from '../helpers/xml-canonicalize'
import { choice, doc, group, q, repeat } from '../helpers/doc-builders'

const goldenDir = fileURLToPath(new URL('./expected', import.meta.url))

const EN = 'English (en)'
const FR = 'Français (fr)'

const FIXTURES: Record<string, () => FormDocument> = {
  basic: () => doc({
    title: 'Basic Test',
    formId: 'basic_test',
    children: [
      q('text', 'respondent_name', 'What is your name?', {
        hint: { default: 'Full legal name' },
        bind: {
          required: 'true()',
          constraint: 'string-length(.) > 1',
          constraintMessage: { default: 'Name is too short' },
        },
      }),
      q('integer', 'age', 'How old are you?', {
        bind: {
          required: 'true()',
          constraint: '. >= 0 and . <= 120',
          constraintMessage: { default: 'Age must be 0-120' },
        },
        body: { appearance: 'thousands-sep' },
      }),
      q('decimal', 'height', 'Height in meters', {
        bind: { relevant: '${age} >= 18' },
        defaultValue: '1.5',
      }),
      q('note', 'intro_note', 'Thank you ${respondent_name}!'),
      q('calculate', 'birth_year', undefined, { bind: { calculation: '2026 - ${age}' } }),
      q('date', 'visit_date', 'Date of visit', { defaultValue: 'today()' }),
      q('select_one', 'consent', 'Do you consent?', { bind: { required: 'true()' }, listRef: 'yes_no' }),
      q('select_multiple', 'symptoms', 'Any symptoms?', {
        listRef: 'symptoms',
        body: { appearance: 'minimal' },
      }),
    ],
    choiceLists: {
      yes_no: [choice('yes', 'Yes'), choice('no', 'No')],
      symptoms: [choice('fever', 'Fever'), choice('cough', 'Cough'), choice('none', 'None')],
    },
  }),

  structure: () => doc({
    title: 'Structure Test',
    formId: 'structure_test',
    children: [
      group('hh', 'Household', [
        q('text', 'address', 'Address'),
        group('gps_meta', 'Location details', [
          q('geopoint', 'location', 'Where is the house?'),
        ]),
      ], { body: { appearance: 'field-list' } }),
      q('integer', 'num_members', 'How many members?'),
      repeat('member', 'Household member', [
        q('text', 'member_name', 'Member name'),
        q('integer', 'member_age', 'Member age'),
        q('text', 'school', 'School name', { bind: { relevant: '${member_age} >= 5' } }),
      ], { repeatCount: '${num_members}' }),
    ],
  }),

  translated: () => doc({
    title: 'Translated Test',
    formId: 'translated_test',
    languages: [EN, FR],
    defaultLanguage: EN,
    children: [
      q('text', 'name', undefined, {
        label: { [EN]: 'Your name?', [FR]: 'Votre nom ?' },
        hint: { [EN]: 'As in the ID', [FR]: 'Comme sur la carte' },
      }),
      q('integer', 'age', undefined, {
        label: { [EN]: 'Your age?', [FR]: 'Votre âge ?' },
        media: { image: { [EN]: 'age.png' } },
        bind: {
          constraint: '. > 0',
          constraintMessage: { [EN]: 'Must be positive', [FR]: 'Doit être positif' },
        },
      }),
      q('select_one', 'color', undefined, {
        label: { [EN]: 'Favourite color?', [FR]: 'Couleur préférée ?' },
        listRef: 'colors',
      }),
    ],
    choiceLists: {
      colors: [
        { name: 'red', label: { [EN]: 'Red', [FR]: 'Rouge' }, media: { image: { [EN]: 'red.png' } } },
        { name: 'blue', label: { [EN]: 'Blue', [FR]: 'Bleu' } },
      ],
    },
  }),

  cascade: () => doc({
    title: 'Cascade Test',
    formId: 'cascade_test',
    children: [
      q('select_one', 'state', 'State?', { listRef: 'state' }),
      q('select_one', 'district', 'District?', { listRef: 'district', choiceFilter: 'state=${state}' }),
      q('select_one_from_file', 'village', 'Village?', { itemsetFile: 'villages.csv' }),
      q('select_one', 'shuffled', 'Random color?', {
        listRef: 'colors',
        body: { parameters: { randomize: 'true', seed: '42' } },
      }),
    ],
    choiceLists: {
      state: [choice('north', 'North'), choice('south', 'South')],
      district: [
        choice('n1', 'North One', { state: 'north' }),
        choice('n2', 'North Two', { state: 'north' }),
        choice('s1', 'South One', { state: 'south' }),
      ],
      colors: [choice('red', 'Red'), choice('blue', 'Blue')],
    },
  }),

  widgets: () => doc({
    title: 'Widgets Test',
    formId: 'widgets_test',
    children: [
      q('start', 'start'),
      q('end', 'end'),
      q('today', 'today'),
      q('deviceid', 'deviceid'),
      q('audit', 'audit', undefined, {
        body: {
          parameters: {
            'location-priority': 'balanced',
            'location-min-interval': '60',
            'location-max-age': '120',
          },
        },
      }),
      q('start-geopoint', 'start_location'),
      q('background-audio', 'recording', undefined, { body: { parameters: { quality: 'low' } } }),
      q('range', 'rating', 'Rate 1-10', {
        body: { parameters: { start: '1', end: '10', step: '1' }, appearance: 'rating' },
      }),
      q('range', 'weight', 'Weight', {
        body: { parameters: { start: '0.5', end: '5.0', step: '0.5' } },
      }),
      q('rank', 'priorities', 'Rank your priorities', { listRef: 'priorities' }),
      q('geotrace', 'path', 'Walk the path'),
      q('geoshape', 'plot', 'Outline the plot'),
      q('image', 'photo', 'Take a photo', { body: { parameters: { 'max-pixels': '1024' } } }),
      q('audio', 'sound', 'Record a sound', { body: { parameters: { quality: 'voice-only' } } }),
      q('video', 'clip', 'Record a clip'),
      q('file', 'doc', 'Attach a document'),
      q('barcode', 'code', 'Scan the code'),
      q('acknowledge', 'ack', 'I have read the terms'),
      q('datetime', 'appointment', 'Appointment'),
      q('time', 'wake_time', 'Wake-up time'),
    ],
    choiceLists: {
      priorities: [choice('health', 'Health'), choice('school', 'School'), choice('roads', 'Roads')],
    },
  }),

  entities: () => doc({
    title: 'Entities Test',
    formId: 'entities_test',
    children: [
      q('text', 'hh_name', 'Household name', { saveTo: 'household_name' }),
      q('geopoint', 'hh_location', 'Household location', { saveTo: 'geometry' }),
    ],
    entities: { datasetName: 'households', label: '${hh_name}' },
  }),

  defaults_trigger: () => doc({
    title: 'Defaults Test',
    formId: 'defaults_test',
    children: [
      q('integer', 'price', 'Price?'),
      q('integer', 'quantity', 'Quantity?', { defaultValue: '1' }),
      q('decimal', 'total', 'Total (edit if needed)', {
        trigger: '${price}',
        bind: { calculation: '${price} * ${quantity}' },
      }),
      q('date', 'delivery', 'Delivery date', { defaultValue: 'today()' }),
    ],
  }),

  submission: () => doc({
    title: 'Submission Test',
    formId: 'submission_test',
    children: [q('text', 'comment', 'Any comments?')],
    settings: {
      instanceName: "concat('c-', ${comment})",
      style: 'pages',
      submissionUrl: 'https://example.org/submission',
      publicKey: 'MIIBIjANBgkq',
    },
  }),
}

describe('golden parity with pyxform 4.5.0', () => {
  for (const [name, build] of Object.entries(FIXTURES)) {
    it(`matches ${name}.xml`, () => {
      const { xml, issues } = serializeXForm(build())
      expect(issues.filter((i) => i.severity === 'error')).toEqual([])
      const expected = readFileSync(join(goldenDir, `${name}.xml`), 'utf8')
      expect(canonicalizeXForm(xml)).toBe(canonicalizeXForm(expected))
    })
  }
})
