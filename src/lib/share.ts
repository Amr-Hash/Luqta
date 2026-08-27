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

export async function fetchPageSnippet(url: string): Promise<string | null> {
  // Browser CORS usually blocks this; keep as best-effort enrichment.
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const html = await res.text()
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()
    const desc = html
      .match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      )?.[1]
      ?.trim()
    const ogTitle = html
      .match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
      )?.[1]
      ?.trim()
    return [ogTitle || title, desc].filter(Boolean).join('\n')
  } catch {
    return null
  }
}

export function composeExtractionSource(payload: SharePayload, snippet: string | null): string {
  return [
    payload.title && `Title: ${payload.title}`,
    payload.url && `URL: ${payload.url}`,
    payload.text && `Shared text:\n${payload.text}`,
    snippet && `Page snippet:\n${snippet}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
