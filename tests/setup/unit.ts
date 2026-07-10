// Node-environment unit tests: provide IndexedDB for persistence specs.
import 'fake-indexeddb/auto'

// Provide DOMParser for the XForm parser (browsers have it natively;
// src/core/xform/xml-reader.ts feature-detects it off globalThis).
import { DOMParser as XmldomDOMParser } from '@xmldom/xmldom'

if ((globalThis as { DOMParser?: unknown }).DOMParser === undefined) {
  (globalThis as { DOMParser?: unknown }).DOMParser = XmldomDOMParser
}

// jszip reads Blob content through FileReader, which browsers provide but the
// Node test environment does not; back it with Blob.arrayBuffer() so archive
// building can stream attachment blobs here as it does in the app.
if (typeof (globalThis as { FileReader?: unknown }).FileReader === 'undefined') {
  class NodeFileReader {
    onload: ((e: { target: { result: ArrayBuffer } }) => void) | null = null
    onerror: ((e: { target: { error: unknown } }) => void) | null = null
    readAsArrayBuffer (blob: Blob): void {
      blob.arrayBuffer().then(
        (result) => this.onload?.({ target: { result } }),
        (error: unknown) => this.onerror?.({ target: { error } })
      )
    }
  }
  (globalThis as { FileReader?: unknown }).FileReader = NodeFileReader
}
