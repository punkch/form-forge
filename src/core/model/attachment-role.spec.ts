import { describe, expect, it } from 'vitest'

import { attachmentRefsFor, DEFAULT_MEDIATYPE, mediatypeFor, roleFor } from './attachment-role'

describe('roleFor', () => {
  it('classifies by data-file extension regardless of mimetype', () => {
    expect(roleFor('choices.csv', 'text/csv')).toBe('csv')
    expect(roleFor('places.geojson', 'application/geo+json')).toBe('geojson')
    expect(roleFor('external.xml', 'text/xml')).toBe('xml')
    // Extension wins even when the mimetype would suggest media.
    expect(roleFor('data.csv', 'image/png')).toBe('csv')
  })

  it('is case-insensitive on the extension', () => {
    expect(roleFor('CHOICES.CSV', 'text/csv')).toBe('csv')
    expect(roleFor('Places.GeoJSON', '')).toBe('geojson')
  })

  it('classifies image, audio and video mimetypes as media', () => {
    expect(roleFor('photo.png', 'image/png')).toBe('media')
    expect(roleFor('clip.mp3', 'audio/mpeg')).toBe('media')
    expect(roleFor('intro.mp4', 'video/mp4')).toBe('media')
  })

  it('falls back to other for unknown extensions and mimetypes', () => {
    expect(roleFor('notes.pdf', 'application/pdf')).toBe('other')
    expect(roleFor('README', 'application/octet-stream')).toBe('other')
    expect(roleFor('', '')).toBe('other')
  })
})

describe('mediatypeFor', () => {
  it('maps known extensions case-insensitively', () => {
    expect(mediatypeFor('choices.csv')).toBe('text/csv')
    expect(mediatypeFor('PHOTO.PNG')).toBe('image/png')
    expect(mediatypeFor('clip.Mp3')).toBe('audio/mpeg')
    expect(mediatypeFor('places.geojson')).toBe('application/geo+json')
  })

  it('falls back to the default for unknown, missing or extension-less names', () => {
    expect(mediatypeFor('notes.pdf')).toBe(DEFAULT_MEDIATYPE)
    expect(mediatypeFor('README')).toBe(DEFAULT_MEDIATYPE)
    // A bare known-extension word has no extension at all (no dot).
    expect(mediatypeFor('png')).toBe(DEFAULT_MEDIATYPE)
    expect(mediatypeFor('')).toBe(DEFAULT_MEDIATYPE)
  })

  it('never resolves prototype keys as mediatypes', () => {
    expect(mediatypeFor('x.constructor')).toBe(DEFAULT_MEDIATYPE)
    expect(mediatypeFor('x.__proto__')).toBe(DEFAULT_MEDIATYPE)
  })
})

describe('attachmentRefsFor', () => {
  it('rebuilds placeholder-id refs with role and size from the blobs', () => {
    const refs = attachmentRefsFor([
      { filename: 'villages.csv', mediatype: 'text/csv', blob: new Blob(['a,b\n']) },
      { filename: 'logo.png', mediatype: 'image/png', blob: new Blob([new Uint8Array(3)]) },
    ])
    expect(refs).toEqual([
      { id: '', filename: 'villages.csv', mediatype: 'text/csv', size: 4, role: 'csv' },
      { id: '', filename: 'logo.png', mediatype: 'image/png', size: 3, role: 'media' },
    ])
  })
})
