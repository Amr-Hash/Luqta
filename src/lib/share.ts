import type { SharePayload } from '@/types/product'

export function parseShareSearch(search: string): SharePayload {
  const params = new URLSearchParams(search)
  const title = params.get('title')?.trim() ?? ''
  const text = params.get('text')?.trim() ?? ''
  const url = params.get('url')?.trim() ?? ''

  // Many Android share sheets put the URL inside `text`
  const urlFromText = text.match(/https?:\/\/[^\s]+/i)?.[0] ?? ''
  const resolvedUrl = normalizeProductUrl(url || urlFromText)
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

/** Fix common broken shop URLs like `/path&ovs=1` (missing `?`). */
export function normalizeProductUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    let fixed = trimmed
    if (!fixed.includes('?')) {
      const amp = fixed.indexOf('&')
      if (amp > 0) {
        fixed = `${fixed.slice(0, amp)}?${fixed.slice(amp + 1)}`
      }
    }
    return new URL(fixed).href
  } catch {
    return trimmed
  }
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

function htmlToSnippet(html: string): string | null {
  const title =
    metaContent(html, 'property', 'og:title') ||
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ||
    ''
  const desc =
    metaContent(html, 'name', 'description') ||
    metaContent(html, 'property', 'og:description')
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  const h1Text = h1 ? stripTags(h1) : ''
  const bodyText = stripTags(html).slice(0, 4000)

  const snippet = [
    title && `Page title: ${title}`,
    h1Text && h1Text !== title && `Heading: ${h1Text}`,
    desc && `Description: ${desc}`,
    bodyText && `Page text:\n${bodyText}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return snippet || null
}

async function fetchHtml(url: string): Promise<{ html: string; via: 'proxy' | 'direct' } | null> {
  const target = normalizeProductUrl(url)

  // Local Vite middleware bypasses browser CORS (dev / preview with plugin).
  if (import.meta.env.DEV) {
    try {
      const proxyUrl = `/__luqta_proxy?url=${encodeURIComponent(target)}`
      const res = await fetch(proxyUrl)
      if (res.ok) {
        return { html: await res.text(), via: 'proxy' }
      }
    } catch {
      /* fall through to direct */
    }
  }

  try {
    const res = await fetch(target, {
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    })
    if (!res.ok) return null
    return { html: await res.text(), via: 'direct' }
  } catch {
    return null
  }
}

export type PageFetchFailure = 'insecure' | 'blocked' | 'empty'

export type PageFetchResult = {
  snippet: string | null
  via: 'proxy' | 'direct' | null
  failure: PageFetchFailure | null
}

/** True when an https app page cannot fetch an http product URL (mixed content). */
export function isInsecureProductUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeProductUrl(url))
    if (parsed.protocol !== 'http:') return false
    if (typeof window === 'undefined') return false
    return window.location.protocol === 'https:'
  } catch {
    return false
  }
}

/** Fetch the shared product URL (proxy in local dev to avoid CORS). */
export async function fetchPageSnippet(url: string): Promise<string | null> {
  const result = await fetchPageDetailed(url)
  return result.snippet
}

export async function fetchPageDetailed(url: string): Promise<PageFetchResult> {
  if (isInsecureProductUrl(url)) {
    return { snippet: null, via: null, failure: 'insecure' }
  }

  const loaded = await fetchHtml(url)
  if (!loaded) return { snippet: null, via: null, failure: 'blocked' }
  const snippet = htmlToSnippet(loaded.html)
  if (!snippet) return { snippet: null, via: loaded.via, failure: 'empty' }
  return { snippet, via: loaded.via, failure: null }
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
