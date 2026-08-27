import type { SharePayload } from '@/types/product'

export function parseShareSearch(search: string): SharePayload {
  const params = new URLSearchParams(search)
  const title = params.get('title')?.trim() ?? ''
  const text = params.get('text')?.trim() ?? ''
  const url = params.get('url')?.trim() ?? ''

  // Many Android share sheets put the URL inside `text`
  const urlFromText = text.match(/https?:\/\/[^\s]+/i)?.[0] ?? ''
  const resolvedUrl = url || urlFromText
  const cleanText = urlFromText
    ? text.replace(urlFromText, '').trim()
    : text

  return {
    title,
    text: cleanText,
    url: resolvedUrl,
  }
}

export function hasShareContent(payload: SharePayload): boolean {
  return Boolean(payload.title || payload.text || payload.url)
}

/** Build extraction input only from shared/pasted content — never fetches remote pages. */
export function composeExtractionSource(payload: SharePayload): string {
  return [
    payload.title && `Title: ${payload.title}`,
    payload.url && `URL: ${payload.url}`,
    payload.text && `Shared text:\n${payload.text}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
