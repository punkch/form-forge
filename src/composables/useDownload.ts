/** Client-side file download helper. */
export const downloadBlob = (data: Blob | Uint8Array | string, filename: string, mimetype?: string): void => {
  const blob = data instanceof Blob
    ? data
    : new Blob([data as BlobPart], { type: mimetype ?? 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  // Firefox only honors programmatic downloads for in-document anchors.
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
