// Node-environment unit tests: provide IndexedDB for persistence specs.
import 'fake-indexeddb/auto'

// Provide DOMParser for the XForm parser (browsers have it natively;
// src/core/xform/xml-reader.ts feature-detects it off globalThis).
import { DOMParser as XmldomDOMParser } from '@xmldom/xmldom'

if ((globalThis as { DOMParser?: unknown }).DOMParser === undefined) {
  (globalThis as { DOMParser?: unknown }).DOMParser = XmldomDOMParser
}
