/** The exact `ArrayBuffer` window a `Uint8Array` views (APIs like JSZip and
 * `readXlsForm` take buffers, generators return typed arrays). */
export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
