// Uploading files (images pasted into a description, attachments on an issue).
// Bytes go to the API, which stores them on disk and hands back a URL — the
// workspace document only ever holds that URL. Inlining a file as a data URL
// would bloat the document we persist to localStorage and PUT on every change,
// so a base64 fallback is only used when the API is unreachable, and only for
// small images.
import { getApiToken } from './api'

/** Matches the server's limit (server/files.js). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
/** Largest file we'll inline as a data URL when the API can't be reached. */
const MAX_INLINE_BYTES = 512 * 1024

export interface UploadedAsset {
  url: string
  filename: string
  contentType: string
  size: number
  /** True when the API was unreachable and the bytes are inlined as a data URL. */
  inline?: boolean
}

export class UploadError extends Error {}

/** "2.4 MB" — the size string Linear shows next to an attachment. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const n = bytes / 1024 ** i
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`
}

/** Coarse kind for the attachment icon, from the mime type then the extension. */
export function kindForFile(name: string, type = ''): 'image' | 'file' | 'design' | 'video' {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video'
  if (['fig', 'sketch', 'xd'].includes(ext)) return 'design'
  return 'file'
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new UploadError('Could not read the file'))
    reader.readAsDataURL(file)
  })

/**
 * Upload one file and resolve to its URL. `onProgress` gets 0–1 as the bytes go
 * out (XHR rather than fetch, which can't report request progress).
 */
export function uploadAsset(file: File, onProgress?: (fraction: number) => void): Promise<UploadedAsset> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return Promise.reject(
      new UploadError(`${file.name} is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit`),
    )
  }

  const contentType = file.type || 'application/octet-stream'

  return new Promise<UploadedAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/files')
    const token = getApiToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', contentType)
    // Header values must be latin-1; a Vietnamese filename would throw.
    xhr.setRequestHeader('x-filename', encodeURIComponent(file.name))

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { file: f } = JSON.parse(xhr.responseText)
          onProgress?.(1)
          resolve({
            url: f.assetUrl,
            filename: f.filename,
            contentType: f.contentType,
            size: f.size,
          })
          return
        } catch {
          /* fall through to the error below */
        }
      }
      let message = `Upload failed (${xhr.status})`
      try {
        message = JSON.parse(xhr.responseText).error || message
      } catch {
        /* keep the status message */
      }
      reject(new UploadError(message))
    }

    // Server unreachable: keep small images usable by inlining them, and be
    // explicit about anything too big to inline.
    xhr.onerror = () => {
      if (file.size <= MAX_INLINE_BYTES && contentType.startsWith('image/')) {
        readAsDataUrl(file).then(
          (url) => resolve({ url, filename: file.name, contentType, size: file.size, inline: true }),
          reject,
        )
      } else {
        reject(new UploadError('Cannot reach the server to upload this file'))
      }
    }

    xhr.send(file)
  })
}
