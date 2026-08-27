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

function metaContent(html: string, attr: 'name' | 'property', key: string): string {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`,
    'i',
  )
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`,
    'i',
  )
  return (html.match(re)?.[1] ?? html.match(re2)?.[1] ?? '').trim()
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Fetch the shared product URL (the link itself — not a third-party API). */
export async function fetchPageSnippet(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    })
    if (!res.ok) return null
    const html = await res.text()

    const title =
      metaContent(html, 'property', 'og:title') ||
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ||
      ''
    const desc =
      metaContent(html, 'name', 'description') ||
      metaContent(html, 'property', 'og:description')
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    const h1Text = h1 ? stripTags(h1) : ''

    // Visible product-ish text helps local price/spec parsing
    const bodyText = stripTags(html).slice(0, 4000)

    return [
      title && `Page title: ${title}`,
      h1Text && h1Text !== title && `Heading: ${h1Text}`,
      desc && `Description: ${desc}`,
      bodyText && `Page text:\n${bodyText}`,
    ]
      .filter(Boolean)
      .join('\n\n')
  } catch {
    // CORS often blocks browser fetches from shop sites — caller falls back to shared text.
    return null
  }
}

export function composeExtractionSource(
  payload: SharePayload,
  snippet: string | null,
): string {
  return [
    payload.title && `Title: ${payload.title}`,
    payload.url && `URL: ${payload.url}`,
    payload.text && `Shared text:\n${payload.text}`,
    snippet && snippet,
  ]
    .filter(Boolean)
    .join('\n\n')
}
