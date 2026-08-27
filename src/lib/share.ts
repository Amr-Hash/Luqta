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
import {
  emptySignals,
  mergeSignals,
  parseProductSignals,
  signalsHaveProduct,
  signalsToSnippet,
  type ProductSignals,
} from '@/lib/productSignals'
import { enrichFromShops } from '@/lib/shopEnrichers'

export function parseShareSearch(search: string): SharePayload {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  let title = params.get('title')?.trim() ?? ''
  let text = params.get('text')?.trim() ?? ''
  let url =
    params.get('url')?.trim() ||
    params.get('link')?.trim() ||
    params.get('shared_url')?.trim() ||
    ''

  title = softDecode(title)
  text = softDecode(text)
  url = softDecode(url)

  const found = findFirstUrl(url) || findFirstUrl(text) || findFirstUrl(title)
  const resolvedUrl = found ? normalizeProductUrl(found) : ''

  let cleanTitle = title
  let cleanText = text
  if (resolvedUrl) {
    cleanTitle = stripUrlVariants(cleanTitle, resolvedUrl, found!)
    cleanText = stripUrlVariants(cleanText, resolvedUrl, found!)
  }

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

  if (cleanTitle && findFirstUrl(cleanTitle) === cleanTitle) {
    cleanTitle = ''
  }

  if (
    cleanTitle &&
    resolvedUrl &&
    stripUrlVariants(cleanTitle, resolvedUrl, found!).length < 2
  ) {
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

function stripUrlVariants(
  haystack: string,
  href: string,
  rawToken: string,
): string {
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

async function fetchHtml(
  url: string,
): Promise<{ html: string; via: 'proxy' | 'direct' } | null> {
  const target = normalizeProductUrl(url)

  if (import.meta.env.DEV) {
    try {
      const proxyUrl = `/__luqta_proxy?url=${encodeURIComponent(target)}`
      const res = await fetch(proxyUrl)
      if (res.ok) {
        return { html: await res.text(), via: 'proxy' }
      }
    } catch {
      /* fall through */
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
          const signals = parseProductSignals(body, target)
          const snippet = signalsToSnippet(signals)
          if (snippet && !isBlockedShopShell(snippet)) return snippet
          continue
        }

        const snippet = readerMarkdownToSnippet(body.slice(0, 40000), target)
        if (snippet && !isBlockedShopShell(snippet)) return snippet
      } catch {
        /* try next */
      }
    }
  }

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

export async function fetchPageSnippet(
  url: string,
  language: AppLanguage = 'en',
): Promise<string | null> {
  const result = await fetchPageDetailed(url, language)
  return result.snippet
}

function combineSnippet(
  signals: ProductSignals,
  pageSnippet: string | null,
): string | null {
  const fromSignals = signalsToSnippet(signals)
  if (fromSignals && pageSnippet && pageSnippet !== fromSignals) {
    // Prefer structured signals first; keep page text for specs/summary
    const pageOnly = pageSnippet
      .replace(/(?:^|\n)\s*Page title:.*$/gim, '')
      .replace(/(?:^|\n)\s*Brand:.*$/gim, '')
      .replace(/(?:^|\n)\s*Price:.*$/gim, '')
      .replace(/(?:^|\n)\s*Category breadcrumbs:.*$/gim, '')
      .replace(/(?:^|\n)\s*SKU:.*$/gim, '')
      .trim()
    return pageOnly ? `${fromSignals}\n\n${pageOnly}` : fromSignals
  }
  return fromSignals || pageSnippet
}

export async function fetchPageDetailed(
  url: string,
  language: AppLanguage = 'en',
): Promise<PageFetchResult> {
  const localized = localizeProductUrl(normalizeProductUrl(url), language)

  if (isInsecureProductUrl(localized)) {
    return { snippet: null, via: null, failure: 'insecure' }
  }

  let signals = emptySignals()

  // Optional shop enrichers (gap-fill only)
  try {
    const patch = await enrichFromShops(localized, language)
    if (patch) signals = mergeSignals(signals, patch)
  } catch {
    /* ignore */
  }

  const loaded = await fetchHtml(localized)
  if (loaded) {
    const fromHtml = parseProductSignals(loaded.html, localized)
    signals = mergeSignals(signals, fromHtml)
    const snippet = combineSnippet(signals, signalsToSnippet(fromHtml))
    if (snippet && signalsHaveProduct(signals)) {
      return { snippet, via: loaded.via, failure: null }
    }
  }

  const reader = await fetchViaReader(localized, language)
  if (reader) {
    const fromReader = parseProductSignals(reader, localized)
    signals = mergeSignals(signals, fromReader)
  }

  const snippet = combineSnippet(signals, reader)
  if (snippet) {
    return {
      snippet,
      via: reader ? 'reader' : loaded?.via ?? 'proxy',
      failure: null,
    }
  }

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

  // Shared text may already contain Price:/Brand: from the bookmarklet
  let sharedSignals: ProductSignals | null = null
  if (payload.text?.trim()) {
    sharedSignals = parseProductSignals(payload.text, payload.url)
  }

  const sharedSnippet =
    sharedSignals && signalsHaveProduct(sharedSignals)
      ? signalsToSnippet(sharedSignals)
      : null

  return [
    title && `Title: ${title}`,
    urlHint.brand && `Brand: ${urlHint.brand}`,
    payload.url && `URL: ${payload.url}`,
    sharedSnippet && sharedSnippet !== usableSnippet ? sharedSnippet : null,
    payload.text &&
      !sharedSnippet &&
      `Shared text:\n${payload.text}`,
    usableSnippet,
    !usableSnippet && urlHint.title && `Page title: ${urlHint.title}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
