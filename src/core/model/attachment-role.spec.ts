import { describe, expect, it } from 'vitest'

import { roleFor } from './attachment-role'

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
