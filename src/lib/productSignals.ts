import { parsePriceAmount } from '@/lib/price'
import { productHintFromUrl } from '@/lib/pageContent'

/** Shop-agnostic product fields gathered before heuristic/LLM extract. */
export type ProductSignals = {
  title: string | null
  brand: string | null
  price: number | null
  currency: string | null
  summary: string | null
  breadcrumbs: string[]
  sku: string | null
  /** 0–1 rough confidence from structured vs heuristic sources */
  confidence: number
}

export function emptySignals(): ProductSignals {
  return {
    title: null,
    brand: null,
    price: null,
    currency: null,
    summary: null,
    breadcrumbs: [],
    sku: null,
    confidence: 0,
  }
}

/** Prefer non-null fields; only overwrite when patch has clearly higher confidence. */
export function mergeSignals(
  base: ProductSignals,
  patch: Partial<ProductSignals>,
  confidenceBoost = 0,
): ProductSignals {
  const baseConf = base.confidence
  const patchConf = patch.confidence ?? 0
  const patchWins = patchConf > baseConf + 0.05

  const pickStr = (
    current: string | null,
    next: string | null | undefined,
  ): string | null => {
    const n = next?.trim() || null
    if (!n) return current
    if (!current) return n
    return patchWins ? n : current
  }

  return {
    title: pickStr(base.title, patch.title),
    brand: pickStr(base.brand, patch.brand),
    price:
      patchWins && patch.price != null
        ? patch.price
        : (base.price ?? patch.price ?? null),
    currency: pickStr(base.currency, patch.currency),
    summary: pickStr(base.summary, patch.summary),
    breadcrumbs:
      base.breadcrumbs.length > 0 && !patchWins
        ? base.breadcrumbs
        : patch.breadcrumbs && patch.breadcrumbs.length > 0
          ? patch.breadcrumbs
          : base.breadcrumbs,
    sku: pickStr(base.sku, patch.sku),
    confidence: Math.min(
      1,
      Math.max(baseConf, patchConf) + confidenceBoost,
    ),
  }
}

function metaContent(
  html: string,
  attr: 'name' | 'property',
  key: string,
): string {
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

function asTypeList(type: unknown): string[] {
  if (!type) return []
  if (Array.isArray(type)) return type.map(String)
  return [String(type)]
}

function isProductType(type: unknown): boolean {
  return asTypeList(type).some((t) =>
    /Product|ProductGroup|IndividualProduct/i.test(t),
  )
}

function brandFromLd(brand: unknown): string | null {
  if (typeof brand === 'string') return brand.trim() || null
  if (brand && typeof brand === 'object') {
    const name = (brand as { name?: unknown }).name
    if (typeof name === 'string') return name.trim() || null
  }
  return null
}

function offerPrice(offers: unknown): {
  price: number | null
  currency: string | null
} {
  if (!offers) return { price: null, currency: null }
  const o = Array.isArray(offers) ? offers[0] : offers
  if (!o || typeof o !== 'object') return { price: null, currency: null }
  const rec = o as Record<string, unknown>
  const raw = rec.price ?? rec.lowPrice ?? rec.highPrice
  let price: number | null = null
  if (typeof raw === 'number') price = raw
  else if (typeof raw === 'string') {
    price = Number.parseFloat(raw.replace(/,/g, ''))
    if (!Number.isFinite(price)) price = null
  }
  const currency =
    typeof rec.priceCurrency === 'string' ? rec.priceCurrency : null
  return { price, currency }
}

function flattenLd(nodes: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const rec = node as Record<string, unknown>
    if (Array.isArray(rec['@graph'])) {
      out.push(...flattenLd(rec['@graph'] as unknown[]))
    } else {
      out.push(rec)
    }
  }
  return out
}

function parseJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const raw = m[1]?.trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      blocks.push(...flattenLd(arr))
    } catch {
      /* ignore bad JSON-LD */
    }
  }
  return blocks
}

function breadcrumbsFromLd(nodes: Record<string, unknown>[]): string[] {
  for (const node of nodes) {
    if (
      !asTypeList(node['@type']).some((t) => /BreadcrumbList/i.test(t)) &&
      !node.itemListElement
    ) {
      continue
    }
    const els = node.itemListElement
    if (!Array.isArray(els)) continue
    const names = els
      .map((el) => {
        if (!el || typeof el !== 'object') return ''
        const item = el as Record<string, unknown>
        if (typeof item.name === 'string') return item.name
        const nested = item.item
        if (nested && typeof nested === 'object') {
          const n = (nested as { name?: unknown }).name
          if (typeof n === 'string') return n
        }
        return ''
      })
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length) return names
  }
  return []
}

function signalsFromJsonLd(html: string): Partial<ProductSignals> {
  const nodes = parseJsonLdBlocks(html)
  const product = nodes.find((n) => isProductType(n['@type']))
  const crumbs = breadcrumbsFromLd(nodes)
  if (!product && crumbs.length === 0) return {}

  const { price, currency } = product
    ? offerPrice(product.offers)
    : { price: null, currency: null }

  const title =
    typeof product?.name === 'string'
      ? product.name
      : typeof product?.title === 'string'
        ? product.title
        : null

  return {
    title,
    brand: product ? brandFromLd(product.brand) : null,
    price,
    currency,
    summary:
      typeof product?.description === 'string'
        ? product.description.slice(0, 500)
        : null,
    sku:
      typeof product?.sku === 'string'
        ? product.sku
        : typeof product?.productID === 'string'
          ? product.productID
          : null,
    breadcrumbs: crumbs,
    confidence: product ? 0.9 : crumbs.length ? 0.5 : 0,
  }
}

function signalsFromOpenGraph(html: string): Partial<ProductSignals> {
  const title =
    metaContent(html, 'property', 'og:title') ||
    metaContent(html, 'name', 'twitter:title') ||
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ||
    null
  const summary =
    metaContent(html, 'property', 'og:description') ||
    metaContent(html, 'name', 'description') ||
    null
  const priceRaw =
    metaContent(html, 'property', 'og:price:amount') ||
    metaContent(html, 'property', 'product:price:amount') ||
    metaContent(html, 'name', 'price')
  const currency =
    metaContent(html, 'property', 'og:price:currency') ||
    metaContent(html, 'property', 'product:price:currency') ||
    null
  const brand =
    metaContent(html, 'property', 'product:brand') ||
    metaContent(html, 'name', 'brand') ||
    null
  let price: number | null = null
  if (priceRaw) {
    const n = Number.parseFloat(priceRaw.replace(/,/g, ''))
    if (Number.isFinite(n)) price = n
  }
  const confidence = title || price != null ? 0.7 : 0
  return {
    title: title || null,
    brand: brand || null,
    price,
    currency: currency || null,
    summary: summary || null,
    confidence,
  }
}

function signalsFromMicrodata(html: string): Partial<ProductSignals> {
  // Lightweight: itemprop attributes in HTML string
  const name = html.match(
    /itemprop=["']name["'][^>]*>([^<]+)|itemprop=["']name["'][^>]*content=["']([^"']+)/i,
  )
  const priceRaw = html.match(
    /itemprop=["']price["'][^>]*content=["']([^"']+)|itemprop=["']price["'][^>]*>([^<]+)/i,
  )
  const currency = html.match(
    /itemprop=["']priceCurrency["'][^>]*content=["']([^"']+)/i,
  )?.[1]
  const brand = html.match(
    /itemprop=["']brand["'][^>]*>([^<]+)|itemprop=["']brand["'][^>]*content=["']([^"']+)/i,
  )
  const title = (name?.[1] || name?.[2] || '').trim() || null
  const priceStr = (priceRaw?.[1] || priceRaw?.[2] || '').trim()
  const price = priceStr
    ? Number.parseFloat(priceStr.replace(/,/g, ''))
    : NaN
  if (!title && !Number.isFinite(price)) return {}
  return {
    title,
    brand: (brand?.[1] || brand?.[2] || '').trim() || null,
    price: Number.isFinite(price) ? price : null,
    currency: currency?.trim() || null,
    confidence: 0.65,
  }
}

function signalsFromLabeledText(text: string): Partial<ProductSignals> {
  const title =
    text.match(/(?:^|\n)\s*(?:Page title|Title|Heading):\s*(.+)/i)?.[1]?.trim() ||
    null
  const brand =
    text.match(/(?:^|\n)\s*Brand:\s*(.+)/i)?.[1]?.trim() || null
  const crumbsLine = text.match(
    /(?:^|\n)\s*Category breadcrumbs:\s*(.+)/i,
  )?.[1]
  const breadcrumbs = crumbsLine
    ? crumbsLine
        .split(/\s*[›>\/|]\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const sku = text.match(/(?:^|\n)\s*SKU:\s*(.+)/i)?.[1]?.trim() || null
  const summary =
    text.match(/(?:^|\n)\s*Description:\s*(.+)/i)?.[1]?.trim() || null
  const { price, currency } = parsePriceAmount(text)
  return {
    title,
    brand,
    price,
    currency,
    summary,
    breadcrumbs,
    sku,
    confidence: title || price != null ? 0.55 : 0,
  }
}

/**
 * Parse HTML and/or plain reader text into shop-agnostic product signals.
 */
export function parseProductSignals(
  input: string,
  pageUrl?: string | null,
): ProductSignals {
  let signals = emptySignals()
  const isHtml = /<!doctype html|<html[\s>]|<script[\s>]|<meta[\s>]/i.test(
    input.slice(0, 2000),
  )

  if (isHtml) {
    signals = mergeSignals(signals, signalsFromJsonLd(input))
    signals = mergeSignals(signals, signalsFromOpenGraph(input))
    signals = mergeSignals(signals, signalsFromMicrodata(input))
    const bodyText = stripTags(input).slice(0, 6000)
    if (bodyText) {
      const fromBody = parsePriceAmount(bodyText)
      if (signals.price == null && fromBody.price != null) {
        signals = mergeSignals(signals, {
          price: fromBody.price,
          currency: fromBody.currency,
          confidence: 0.4,
        })
      }
      if (!signals.title) {
        const h1 = input.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
        const h1Text = h1 ? stripTags(h1) : ''
        if (h1Text) signals = mergeSignals(signals, { title: h1Text })
      }
      if (!signals.summary) {
        signals = mergeSignals(signals, {
          summary: bodyText.slice(0, 400),
          confidence: signals.confidence,
        })
      }
    }
  } else {
    signals = mergeSignals(signals, signalsFromLabeledText(input))
    const { price, currency } = parsePriceAmount(input)
    if (signals.price == null && price != null) {
      signals = mergeSignals(signals, { price, currency, confidence: 0.45 })
    }
  }

  if ((!signals.title || signals.price == null) && pageUrl) {
    const hint = productHintFromUrl(pageUrl)
    if (hint.title || hint.brand || hint.sku) {
      signals = mergeSignals(signals, {
        title: hint.title,
        brand: hint.brand,
        sku: hint.sku,
        confidence: 0.25,
      })
    }
  }

  return signals
}

/** Labeled snippet consumed by extract / LLM. */
export function signalsToSnippet(signals: ProductSignals): string | null {
  const crumbs = signals.breadcrumbs.filter(Boolean).join(' › ')
  const parts = [
    signals.title && `Page title: ${signals.title}`,
    signals.brand && `Brand: ${signals.brand}`,
    signals.price != null &&
      `Price: ${signals.price}${signals.currency ? ` ${signals.currency}` : ''}`,
    crumbs && `Category breadcrumbs: ${crumbs}`,
    signals.sku && `SKU: ${signals.sku}`,
    signals.summary && `Description: ${signals.summary.slice(0, 500)}`,
  ].filter(Boolean)
  return parts.length ? parts.join('\n\n') : null
}

export function signalsHaveProduct(signals: ProductSignals): boolean {
  return Boolean(
    signals.title ||
      signals.price != null ||
      signals.brand ||
      signals.breadcrumbs.length,
  )
}
