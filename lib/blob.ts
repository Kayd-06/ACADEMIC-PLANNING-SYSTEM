/**
 * Helper to securely wrap Vercel Blob URLs through our authenticated server proxy (`/api/blob/serve`),
 * ensuring private blobs are loaded securely while external or data URLs load directly.
 */
export function getBlobUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('/api/blob/serve')) {
    return url
  }
  if (url.includes('.blob.vercel-storage.com')) {
    return `/api/blob/serve?url=${encodeURIComponent(url)}`
  }
  return url
}
