import { describe, expect, it } from 'vitest'

import {
  DATASET_PREVIEW_ROW_CAP,
  datasetColumnsOf,
  datasetFormatOf,
  defaultDatasetParams,
  parseDataset,
} from './parse'

const bigCsv = (rows: number): string =>
  ['name,label', ...Array.from({ length: rows }, (_, i) => `v${i},Village ${i}`)].join('\n')

describe('parseDataset — csv', () => {
  it('splits header and rows, keeping quoted commas intact', () => {
    const parsed = parseDataset('villages.csv', 'name,label\n"a,b","A, B"\nplain,Plain\n')
    expect(parsed.format).toBe('csv')
    expect(parsed.columns).toEqual(['name', 'label'])
    expect(parsed.rows).toEqual([['a,b', 'A, B'], ['plain', 'Plain']])
    expect(parsed.truncated).toBe(false)
    expect(parsed.issues).toEqual([])
  })

  it('handles CRLF line endings and a UTF-8 BOM', () => {
    const parsed = parseDataset('x.csv', '\uFEFF' + 'name,label\r\na,A\r\nb,B\r\n')
    expect(parsed.columns).toEqual(['name', 'label'])
    expect(parsed.rows).toEqual([['a', 'A'], ['b', 'B']])
  })

  it('keeps leading zeros and date-like strings verbatim', () => {
    const parsed = parseDataset('codes.csv', 'code,when\n007,2026-07-09\n08,1/2\n')
    expect(parsed.rows).toEqual([['007', '2026-07-09'], ['08', '1/2']])
  })

  it('flags empty files and yields no columns', () => {
    const parsed = parseDataset('empty.csv', '')
    expect(parsed.columns).toEqual([])
    expect(parsed.rows).toEqual([])
    expect(parsed.issues.map((i) => i.code)).toEqual(['dataset.empty'])
  })

  it('caps rows at the preview limit and reports truncation', () => {
    const parsed = parseDataset('big.csv', bigCsv(DATASET_PREVIEW_ROW_CAP + 20))
    expect(parsed.rows).toHaveLength(DATASET_PREVIEW_ROW_CAP)
    expect(parsed.truncated).toBe(true)

    const exact = parseDataset('exact.csv', bigCsv(DATASET_PREVIEW_ROW_CAP))
    expect(exact.rows).toHaveLength(DATASET_PREVIEW_ROW_CAP)
    expect(exact.truncated).toBe(false)
  })

  it('accepts ArrayBuffer input', () => {
    const buffer = new TextEncoder().encode('name,label\na,A\n').buffer as ArrayBuffer
    expect(parseDataset('x.csv', buffer).rows).toEqual([['a', 'A']])
  })
})

describe('parseDataset — geojson', () => {
  const collection = JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'fs087',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: { title: 'Water point', status: 'good' },
      },
      {
        type: 'Feature',
        id: 'fs088',
        geometry: null,
        properties: { title: 'Other', extra: '5' },
      },
    ],
  })

  it('derives columns from feature ids, property unions and geometry', () => {
    const parsed = parseDataset('sites.geojson', collection)
    expect(parsed.columns).toEqual(['id', 'title', 'status', 'extra', 'geometry'])
    expect(parsed.rows).toEqual([
      ['fs087', 'Water point', 'good', '', 'Point'],
      ['fs088', 'Other', '', '5', ''],
    ])
    expect(parsed.issues).toEqual([])
  })

  it('rejects malformed JSON with an error issue', () => {
    const parsed = parseDataset('bad.geojson', '{ not json')
    expect(parsed.columns).toEqual([])
    expect(parsed.issues.map((i) => `${i.severity}:${i.code}`)).toEqual(['error:dataset.invalid-geojson'])
  })

  it('rejects JSON that is not a top-level FeatureCollection', () => {
    const parsed = parseDataset('point.geojson', '{"type":"Feature","properties":{}}')
    expect(parsed.issues.map((i) => i.code)).toEqual(['dataset.invalid-geojson'])
  })

  it('lets id/geometry properties suppress the synthetic columns and stringifies object cell values', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        id: 'top-1',
        geometry: { type: 'Point' },
        properties: { id: 'prop-1', geometry: 'custom', meta: { k: 'v' } },
      }],
    })
    const parsed = parseDataset('collide.geojson', text)
    // A property literally named id/geometry wins — no duplicated synthetic column.
    expect(parsed.columns).toEqual(['id', 'geometry', 'meta'])
    // Object-valued properties fall through cellText to JSON.
    expect(parsed.rows).toEqual([['prop-1', 'custom', '{"k":"v"}']])
  })
})

describe('parseDataset — xml and unknown formats', () => {
  it('returns raw text mode for xml', () => {
    const parsed = parseDataset('lookup.xml', '<root><item/></root>')
    expect(parsed.format).toBe('xml')
    expect(parsed.columns).toEqual([])
    expect(parsed.rawText).toBe('<root><item/></root>')
  })
})

describe('datasetColumnsOf', () => {
  it('reads only the csv header', () => {
    expect(datasetColumnsOf('v.csv', bigCsv(3))).toEqual(['name', 'label'])
  })

  it('dedupes repeated non-empty csv header names', () => {
    expect(datasetColumnsOf('dupes.csv', 'name,label,name,,region,label\nv1,V1,v1,,r1,V1\n'))
      .toEqual(['name', 'label', 'region'])
  })

  it('returns null for xml, empty and malformed files', () => {
    expect(datasetColumnsOf('a.xml', '<root/>')).toBeNull()
    expect(datasetColumnsOf('a.csv', '')).toBeNull()
    expect(datasetColumnsOf('a.geojson', '{ nope')).toBeNull()
  })

  it('returns geojson columns', () => {
    const text = '{"type":"FeatureCollection","features":[{"id":"a","properties":{"title":"T"},"geometry":{"type":"Point"}}]}'
    expect(datasetColumnsOf('s.geojson', text)).toEqual(['id', 'title', 'geometry'])
  })
})

describe('format helpers', () => {
  it('classifies filenames by extension', () => {
    expect(datasetFormatOf('a.CSV')).toBe('csv')
    expect(datasetFormatOf('b.geojson')).toBe('geojson')
    expect(datasetFormatOf('c.xml')).toBe('xml')
    expect(datasetFormatOf('d.png')).toBeUndefined()
  })

  it('exposes the per-format default value/label columns', () => {
    expect(defaultDatasetParams('csv')).toEqual({ value: 'name', label: 'label' })
    expect(defaultDatasetParams('geojson')).toEqual({ value: 'id', label: 'title' })
  })
})
