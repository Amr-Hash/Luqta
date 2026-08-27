import type { SharePayload } from '@/types/product'
import type { AppLanguage } from '@/types/product'
import { findFirstUrl } from '@/lib/source'
import {
  canonicalizeProductUrl,
  isBlockedShopShell,
  localizeProductUrl,
  noonSkuUrl,
  productHintFromUrl,
  readerMarkdownToSnippet,
} from '@/lib/pageContent'

export function parseShareSearch(search: string): SharePayload {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  let title = params.get('title')?.trim() ?? ''
  let text = params.get('text')?.trim() ?? ''
  // Some share sheets / browsers use `link` instead of `url`
  let url =
    params.get('url')?.trim() ||
    params.get('link')?.trim() ||
    params.get('shared_url')?.trim() ||
    ''

  // Decode once more if Android double-encoded values
  title = softDecode(title)
  text = softDecode(text)
  url = softDecode(url)

  const found = findFirstUrl(url) || findFirstUrl(text) || findFirstUrl(title)
  const resolvedUrl = found ? normalizeProductUrl(found) : ''

  // Strip URL out of title/text so extract uses human title, not the link
  let cleanTitle = title
  let cleanText = text
  if (resolvedUrl) {
    cleanTitle = stripUrlVariants(cleanTitle, resolvedUrl, found!)
    cleanText = stripUrlVariants(cleanText, resolvedUrl, found!)
  }

  // Android often puts "Product name\nhttps://..." only in text
  if (!cleanTitle && cleanText) {
    const lines = cleanText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length >= 1 && lines[0]!.length > 2 && lines[0]!.length < 160) {
      const firstIsUrl = Boolean(findFirstUrl(lines[0]!))
      if (!firstIsUrl) {
        cleanTitle = lines[0]!
        cleanText = lines.slice(1).join('\n').trim()
      }
    }
  }

  // Same idea on one line: "Product name https://shop.com/..."
  if (!cleanTitle && cleanText && resolvedUrl) {
    const idx = cleanText.indexOf(found!)
    if (idx > 2) {
      const before = cleanText.slice(0, idx).trim()
      if (before.length > 2 && before.length < 160 && !findFirstUrl(before)) {
        cleanTitle = before
        cleanText = cleanText.slice(idx + found!.length).trim()
      }
    }
  }

  // If title is literally a URL, drop it
  if (cleanTitle && findFirstUrl(cleanTitle) === cleanTitle) {
    cleanTitle = ''
  }

  // Title that is only the URL with junk around it
  if (cleanTitle && resolvedUrl && stripUrlVariants(cleanTitle, resolvedUrl, found!).length < 2) {
    cleanTitle = ''
  }

  return {
    title: cleanTitle,
    text: cleanText,
    url: resolvedUrl,
  }
}

function softDecode(value: string): string {
  if (!value) return value
  try {
    if (/%[0-9A-Fa-f]{2}/.test(value)) return decodeURIComponent(value)
  } catch {
    /* keep raw */
  }
  return value
}

function stripUrlVariants(haystack: string, href: string, rawToken: string): string {
  if (!haystack) return ''
  let out = haystack
  for (const token of [href, rawToken, href.replace(/^https?:\/\//i, '')]) {
    if (!token) continue
    out = out.split(token).join(' ')
  }
  return out.replace(/\s+/g, ' ').trim()
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
    if (!/^https?:\/\//i.test(fixed) && /^www\./i.test(fixed)) {
      fixed = `https://${fixed}`
    }
    if (!fixed.includes('?')) {
      const amp = fixed.indexOf('&')
      if (amp > 0) {
        fixed = `${fixed.slice(0, amp)}?${fixed.slice(amp + 1)}`
      }
    }
    const href = new URL(fixed).href
    return canonicalizeProductUrl(href)
  } catch {
    // Last resort: encode path for Arabic/spaces
    try {
      const m = trimmed.match(/^(https?:\/\/[^/?#]+)([/?#].*)?$/i)
      if (m) {
        const origin = m[1]!
        const rest = m[2] ?? ''
        return canonicalizeProductUrl(new URL(origin + encodeURI(rest)).href)
      }
    } catch {
      /* ignore */
    }
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

/**
 * Mobile Chrome / PWA cannot CORS-fetch most shop pages, and there is no
 * extension. Jina Reader returns page text with CORS enabled so share-to-app
 * can still extract title/price/specs from a bare URL.
 */
async function fetchViaReader(
  url: string,
  language: AppLanguage = 'en',
): Promise<string | null> {
  const primary = localizeProductUrl(normalizeProductUrl(url), language)
  if (!primary || isInsecureProductUrl(primary)) return null

  const shortNoon = noonSkuUrl(primary)
  const targets = [...new Set([primary, shortNoon].filter(Boolean))] as string[]

  for (const target of targets) {
    const endpoints = [
      `https://r.jina.ai/${target}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    ]

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          mode: 'cors',
          credentials: 'omit',
          headers: {
            Accept: 'text/plain, text/html, */*',
            'Accept-Language':
              language === 'ar' ? 'ar,ar-EG;q=0.9,en;q=0.5' : 'en',
            'X-Retain-Images': 'none',
            'X-With-Images-Summary': 'false',
          },
        })
        if (!res.ok) continue
        const body = (await res.text()).trim()
        if (body.length < 40) continue
        if (isBlockedShopShell(body)) continue

        if (/<!doctype html|<html[\s>]/i.test(body)) {
          if (isBlockedShopShell(body)) continue
          const snippet = htmlToSnippet(body)
          if (snippet && !isBlockedShopShell(snippet)) return snippet
          continue
        }

        const snippet = readerMarkdownToSnippet(body.slice(0, 14000), target)
        if (snippet && !isBlockedShopShell(snippet)) return snippet
      } catch {
        /* try next */
      }
    }
  }

  // Shop blocked remote read — still give the extractor a title from the URL slug
  const hint = productHintFromUrl(url) || productHintFromUrl(primary)
  if (hint.title) {
    return [
      `Page title: ${hint.title}`,
      hint.brand && `Brand: ${hint.brand}`,
      hint.sku && `SKU: ${hint.sku}`,
      `Description: Product page could not be downloaded (shop privacy / bot wall). Title inferred from the link.`,
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  return null
}

export type PageFetchFailure = 'insecure' | 'blocked' | 'empty'

export type PageFetchResult = {
  snippet: string | null
  via: 'proxy' | 'direct' | 'reader' | null
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
export async function fetchPageSnippet(
  url: string,
  language: AppLanguage = 'en',
): Promise<string | null> {
  const result = await fetchPageDetailed(url, language)
  return result.snippet
}

export async function fetchPageDetailed(
  url: string,
  language: AppLanguage = 'en',
): Promise<PageFetchResult> {
  const localized = localizeProductUrl(normalizeProductUrl(url), language)

  if (isInsecureProductUrl(localized)) {
    return { snippet: null, via: null, failure: 'insecure' }
  }

  const loaded = await fetchHtml(localized)
  if (loaded) {
    const snippet = htmlToSnippet(loaded.html)
    if (snippet) return { snippet, via: loaded.via, failure: null }
  }

  // Production / mobile: shops block CORS — use a public reader mirror
  const reader = await fetchViaReader(localized, language)
  if (reader) return { snippet: reader, via: 'reader', failure: null }

  if (loaded) return { snippet: null, via: loaded.via, failure: 'empty' }
  return { snippet: null, via: null, failure: 'blocked' }
}

export function composeExtractionSource(
  payload: SharePayload,
  snippet: string | null,
): string {
  const urlHint = productHintFromUrl(payload.url)
  const usableSnippet =
    snippet && !isBlockedShopShell(snippet) ? snippet : null
  const title = payload.title?.trim() || urlHint.title || null

  return [
    title && `Title: ${title}`,
    urlHint.brand && `Brand: ${urlHint.brand}`,
    payload.url && `URL: ${payload.url}`,
    payload.text && `Shared text:\n${payload.text}`,
    usableSnippet,
    // Always keep a URL-derived title hint for Noon-style slugs when page fetch failed
    !usableSnippet &&
      urlHint.title &&
      `Page title: ${urlHint.title}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
