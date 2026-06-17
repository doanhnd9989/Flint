import { useState } from 'react'
import { Link2 } from 'lucide-react'

/** Best-effort favicon URL for a link's host (falls back to a generic icon). */
export function faviconUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
  } catch {
    return null
  }
}

/** Host without the leading `www.`, used as a fallback link title. */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The site favicon for a link, like Linear's Resources rows. Falls back to a
 * generic link glyph when the URL is unparseable or the favicon fails to load.
 */
export function LinkFavicon({ url, size = 16 }: { url: string; size?: number }) {
  const [errored, setErrored] = useState(false)
  const src = faviconUrl(url)
  if (!src || errored) return <Link2 size={size} className="text-faint" />
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      className="rounded-sm"
      onError={() => setErrored(true)}
    />
  )
}
