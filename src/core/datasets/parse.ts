/**
 * Pure parsing for attached dataset files (CSV / GeoJSON / XML) referenced by
 * select_*_from_file and csv-external questions. Produces column names for
 * the column-aware parameter dropdowns + validator, and capped rows for the
 * preview table. CSV goes through the workbook-read SheetJS adapter so cell
 * text survives verbatim; XML is previewed as raw text only (v1 decision).
 */
import { isRecord } from '../util/guards'
import { error, warning, type Issue } from '../validate/issues'
import { readCsvRows } from '../xlsform/workbook-read'

/** Preview/parse row cap: files can be huge, the dialog shows the head. */
export const DATASET_PREVIEW_ROW_CAP = 500

export type DatasetFormat = 'csv' | 'geojson' | 'xml'

export interface ParsedDataset {
  format: DatasetFormat
  /** Detected column names ([] when none — xml, empty or malformed files). */
  columns: string[]
  /** Data rows aligned with `columns`, capped at DATASET_PREVIEW_ROW_CAP. */
  rows: string[][]
  /** True when the file had more rows than the cap. */
  truncated: boolean
  /** Raw text for formats previewed verbatim (xml / unrecognized). */
  rawText?: string
  issues: Issue[]
}

/** Format implied by the filename extension; undefined for anything else. */
export const datasetFormatOf = (filename: string): DatasetFormat | undefined => {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ext === 'csv' || ext === 'geojson' || ext === 'xml' ? ext : undefined
}

/**
 * Column names ODK uses when the value/label parameters are omitted:
 * CSV datasets default to name/label, GeoJSON features to id/title.
 */
export const defaultDatasetParams = (format: 'csv' | 'geojson'): { value: string, label: string } =>
  format === 'geojson' ? { value: 'id', label: 'title' } : { value: 'name', label: 'label' }

const asText = (data: string | ArrayBuffer): string =>
  typeof data === 'string' ? data : new TextDecoder().decode(data)

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const parseCsv = (text: string): ParsedDataset => {
  // +1 for the header row, +1 sentinel row to detect truncation.
  const raw = readCsvRows(text, DATASET_PREVIEW_ROW_CAP + 2)
  const issues: Issue[] = []
  if (raw.length === 0) {
    issues.push(warning('dataset.empty', 'The file is empty.'))
  }
  return {
    format: 'csv',
    columns: raw[0] ?? [],
    rows: raw.slice(1, DATASET_PREVIEW_ROW_CAP + 1),
    truncated: raw.length > DATASET_PREVIEW_ROW_CAP + 1,
    issues,
  }
}

interface GeoJsonFeature {
  id?: unknown
  properties?: Record<string, unknown>
  geometry?: { type?: unknown } | null
}

const asFeature = (value: unknown): GeoJsonFeature => {
  if (!isRecord(value)) return {}
  return {
    id: value.id,
    properties: isRecord(value.properties) ? value.properties : undefined,
    geometry: isRecord(value.geometry) ? value.geometry : null,
  }
}

const parseGeojson = (text: string): ParsedDataset => {
  const fail = (message: string): ParsedDataset => ({
    format: 'geojson',
    columns: [],
    rows: [],
    truncated: false,
    issues: [error('dataset.invalid-geojson', message)],
  })

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return fail('The file is not valid JSON.')
  }
  if (!isRecord(json) || json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
    return fail('ODK expects a GeoJSON file with a top-level FeatureCollection.')
  }

  const features = json.features.map(asFeature)
  // Column order: id first (top-level feature ids), properties as first seen,
  // then a geometry column noting each feature's geometry type.
  const propertyKeys: string[] = []
  const seen = new Set<string>()
  let hasId = false
  let hasGeometry = false
  for (const feature of features) {
    if (feature.id !== undefined) hasId = true
    if (feature.geometry !== null && feature.geometry !== undefined) hasGeometry = true
    for (const key of Object.keys(feature.properties ?? {})) {
      if (!seen.has(key)) {
        seen.add(key)
        propertyKeys.push(key)
      }
    }
  }
  const columns = [
    ...(hasId && !seen.has('id') ? ['id'] : []),
    ...propertyKeys,
    ...(hasGeometry && !seen.has('geometry') ? ['geometry'] : []),
  ]

  const capped = features.slice(0, DATASET_PREVIEW_ROW_CAP)
  const rows = capped.map((feature) => columns.map((column) => {
    const properties = feature.properties ?? {}
    if (column in properties) return cellText(properties[column])
    if (column === 'id') return cellText(feature.id)
    if (column === 'geometry') return typeof feature.geometry?.type === 'string' ? feature.geometry.type : ''
    return ''
  }))

  return {
    format: 'geojson',
    columns,
    rows,
    truncated: features.length > DATASET_PREVIEW_ROW_CAP,
    issues: [],
  }
}

/** Parses a dataset attachment for preview + column detection. */
export const parseDataset = (filename: string, data: string | ArrayBuffer): ParsedDataset => {
  const text = asText(data)
  const format = datasetFormatOf(filename)
  if (format === 'csv') return parseCsv(text)
  if (format === 'geojson') return parseGeojson(text)
  // XML external instances (and anything unrecognized): raw-text preview only.
  return { format: 'xml', columns: [], rows: [], truncated: false, rawText: text, issues: [] }
}

/**
 * Fast column sniff for validation/dropdowns: CSV reads only the header row;
 * GeoJSON needs a full JSON parse anyway. Returns null when columns cannot
 * be determined (xml, empty or malformed files) — callers must treat null as
 * "unknown, don't validate against it".
 */
export const datasetColumnsOf = (filename: string, data: string | ArrayBuffer): string[] | null => {
  const format = datasetFormatOf(filename)
  if (format === 'csv') {
    // Dedupe repeated headers so the value/label dropdowns never show doubles.
    const header = [...new Set((readCsvRows(asText(data), 1)[0] ?? []).filter((column) => column !== ''))]
    return header.length > 0 ? header : null
  }
  if (format === 'geojson') {
    const parsed = parseGeojson(asText(data))
    if (parsed.issues.some((issue) => issue.severity === 'error')) return null
    return parsed.columns.length > 0 ? parsed.columns : null
  }
  return null
}
