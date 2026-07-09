/**
 * DOM-based XML reading for the XForm parser.
 *
 * Uses the environment's DOMParser (browsers natively; unit tests polyfill
 * @xmldom/xmldom in tests/setup/unit.ts). Kept behind this indirection so
 * src/core stays free of browser-only imports — everything is
 * feature-detected off globalThis.
 */

export class XmlParseError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'XmlParseError'
  }
}

interface DOMParserLike {
  parseFromString: (source: string, mimeType: string) => Document
}

// @xmldom/xmldom accepts { onError } to silence its console reporting;
// the native browser constructor ignores the argument.
type DOMParserCtor = new (options?: { onError: () => void }) => DOMParserLike

/** Parse an XML string, throwing XmlParseError on malformed input. */
export const parseXml = (xml: string): Document => {
  const Parser = (globalThis as { DOMParser?: DOMParserCtor }).DOMParser
  if (Parser === undefined) {
    throw new XmlParseError('No DOMParser available in this environment')
  }
  let doc: Document
  try {
    doc = new Parser({ onError: () => {} }).parseFromString(xml, 'text/xml')
  } catch (err) {
    throw new XmlParseError(err instanceof Error ? err.message : String(err))
  }
  const root = doc.documentElement as Element | null
  if (root === null) throw new XmlParseError('Document has no root element')
  // Browsers report failures via an in-document <parsererror> element
  // instead of throwing (@xmldom/xmldom throws).
  if (root.localName === 'parsererror' || doc.getElementsByTagName('parsererror').length > 0) {
    throw new XmlParseError(root.textContent?.trim() ?? 'XML parse error')
  }
  return doc
}

interface XMLSerializerLike {
  serializeToString: (node: Node) => string
}

/** Serialize a DOM node back to markup (preserved unknown fragments). */
export const serializeNode = (node: Node): string => {
  const Serializer = (globalThis as { XMLSerializer?: new () => XMLSerializerLike }).XMLSerializer
  if (Serializer !== undefined) return new Serializer().serializeToString(node)
  // @xmldom/xmldom nodes implement toString() with namespace fixup.
  return String(node)
}
