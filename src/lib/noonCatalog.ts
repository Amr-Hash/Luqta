/**
 * Noon catalog JSON — reliable title / price / breadcrumbs when HTML is
 * bot-walled. Browser CORS blocks direct calls; we try the Vite proxy (dev),
 * then public readers.
 */

export type NoonCatalogHit = {
  sku: string
  title: string | null
  brand: string | null
  price: number | null
  currency: string | null
  breadcrumbs: string[]
}

const PATH_TO_API_LOCALE: Record<string, { locale: string; currency: string }> = {
  'egypt-ar': { locale: 'ar-eg', currency: 'EGP' },
  'egypt-en': { locale: 'en-eg', currency: 'EGP' },
  'saudi-ar': { locale: 'ar-sa', currency: 'SAR' },
  'saudi-en': { locale: 'en-sa', currency: 'SAR' },
  'uae-ar': { locale: 'ar-ae', currency: 'AED' },
  'uae-en': { locale: 'en-ae', currency: 'AED' },
  'kuwait-ar': { locale: 'ar-kw', currency: 'KWD' },
  'kuwait-en': { locale: 'en-kw', currency: 'KWD' },
  'bahrain-ar': { locale: 'ar-bh', currency: 'BHD' },
  'bahrain-en': { locale: 'en-bh', currency: 'BHD' },
  'oman-ar': { locale: 'ar-om', currency: 'OMR' },
  'oman-en': { locale: 'en-om', currency: 'OMR' },
  'qatar-ar': { locale: 'ar-qa', currency: 'QAR' },
  'qatar-en': { locale: 'en-qa', currency: 'QAR' },
}

export function parseNoonProductUrl(url: string): {
  sku: string
  pathLocale: string
  apiLocale: string
  currency: string
} | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (!(host === 'noon.com' || host.endsWith('.noon.com'))) return null
    const sku = u.pathname.match(/\/(N[A-Z0-9]+)\b/i)?.[1]
    if (!sku) return null
    const pathLocale =
      u.pathname
        .match(
          /^\/((?:egypt|saudi|uae|kuwait|bahrain|oman|qatar)-(?:ar|en))\b/i,
        )?.[1]
        ?.toLowerCase() || 'egypt-ar'
    const mapped = PATH_TO_API_LOCALE[pathLocale] ?? {
      locale: 'ar-eg',
      currency: 'EGP',
    }
    return {
      sku: sku.toUpperCase(),
      pathLocale,
      apiLocale: mapped.locale,
      currency: mapped.currency,
    }
  } catch {
    return null
  }
}

function catalogApiUrl(sku: string): string {
  return `https://www.noon.com/_vs/nc/mp-customer-catalog-api/api/v1/u/${sku}/p`
}

function pickPrice(product: Record<string, unknown>): number | null {
  const ctx = product.context as Record<string, unknown> | undefined
  const fromCtx = ctx?.price
  if (typeof fromCtx === 'number' && Number.isFinite(fromCtx)) return fromCtx
  if (typeof fromCtx === 'string') {
    const n = Number.parseFloat(fromCtx.replace(/,/g, ''))
    if (Number.isFinite(n)) return n
  }
  const variants = product.variants as unknown[] | undefined
  const first = variants?.[0] as Record<string, unknown> | undefined
  const offers = first?.offers as unknown[] | undefined
  const offer = offers?.[0] as Record<string, unknown> | undefined
  const p = offer?.price
  if (typeof p === 'number' && Number.isFinite(p)) return p
  if (typeof p === 'string') {
    const n = Number.parseFloat(p.replace(/,/g, ''))
    if (Number.isFinite(n)) return n
  }
  return null
}

function parseCatalogJson(
  raw: string,
  expectedCurrency: string,
): Omit<NoonCatalogHit, 'sku'> | null {
  const start = raw.indexOf('{"product"')
  const jsonText = start >= 0 ? raw.slice(start) : raw.trim()
  if (!jsonText.startsWith('{')) return null
  try {
    const data = JSON.parse(jsonText) as {
      product?: Record<string, unknown>
    }
    const product = data.product
    if (!product) return null
    const title =
      typeof product.product_title === 'string'
        ? product.product_title.trim()
        : null
    const brand =
      typeof product.brand === 'string' ? product.brand.trim() : null
    const crumbs = Array.isArray(product.breadcrumbs)
      ? product.breadcrumbs
          .map((b) => {
            if (typeof b === 'string') return b
            if (b && typeof b === 'object') {
              const o = b as Record<string, unknown>
              return String(o.name ?? o.title ?? o.code ?? '')
            }
            return ''
          })
          .filter(Boolean)
      : []
    const price = pickPrice(product)
    const ctx = product.context as Record<string, unknown> | undefined
    const currency =
      (typeof ctx?.currency_code === 'string' && ctx.currency_code) ||
      expectedCurrency

    return {
      title,
      brand,
      price,
      currency,
      breadcrumbs: crumbs,
    }
  } catch {
    return null
  }
}

async function fetchCatalogRaw(
  sku: string,
  apiLocale: string,
): Promise<string | null> {
  const api = catalogApiUrl(sku)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-locale': apiLocale,
    'x-platform': 'web',
    Referer: 'https://www.noon.com/',
  }

  // Local Vite middleware — can set locale headers (production GH Pages cannot)
  if (import.meta.env.DEV) {
    try {
      const proxyUrl = `/__luqta_proxy?url=${encodeURIComponent(api)}&locale=${encodeURIComponent(apiLocale)}&json=1`
      const res = await fetch(proxyUrl)
      if (res.ok) {
        const body = await res.text()
        if (body.includes('"product"')) return body
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const res = await fetch(api, {
      mode: 'cors',
      credentials: 'omit',
      headers,
    })
    if (res.ok) {
      const body = await res.text()
      if (body.includes('"product"')) return body
    }
  } catch {
    /* CORS expected in browsers */
  }

  // Jina reader — usually UAE default; caller may discard mismatched prices
  try {
    const res = await fetch(`https://r.jina.ai/${api}`, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        Accept: 'text/plain',
        'X-Retain-Images': 'none',
        'X-Proxy-Headers': JSON.stringify(headers),
      },
    })
    if (res.ok) {
      const body = await res.text()
      if (body.includes('"product"')) return body
    }
  } catch {
    /* ignore */
  }

  return null
}

/**
 * Fetch Noon catalog fields for a product URL. Returns null when unavailable.
 * Price is cleared when the response looks like the wrong market (e.g. UAE
 * defaults for an egypt-* URL).
 */
export async function fetchNoonCatalog(
  url: string,
): Promise<NoonCatalogHit | null> {
  const parsed = parseNoonProductUrl(url)
  if (!parsed) return null

  const raw = await fetchCatalogRaw(parsed.sku, parsed.apiLocale)
  if (!raw) return null

  const hit = parseCatalogJson(raw, parsed.currency)
  if (!hit?.title && hit?.price == null) return null

  let price = hit.price
  // Jina without locale often returns UAE prices (~hundreds AED) for EG SKUs
  if (
    price != null &&
    parsed.currency === 'EGP' &&
    !raw.includes('"currency_code"') &&
    price < 1500 &&
    /egypt-/i.test(parsed.pathLocale)
  ) {
    // Suspicious: espresso machines etc. are thousands of EGP; keep title only
    price = null
  }

  return {
    sku: parsed.sku,
    title: hit.title,
    brand: hit.brand,
    price,
    currency: price != null ? hit.currency ?? parsed.currency : null,
    breadcrumbs: hit.breadcrumbs,
  }
}

/** Build a clean extraction snippet from catalog JSON. */
export function noonCatalogToSnippet(hit: NoonCatalogHit): string {
  const crumbs = hit.breadcrumbs.filter(Boolean).join(' › ')
  return [
    hit.title && `Page title: ${hit.title}`,
    hit.brand && `Brand: ${hit.brand}`,
    hit.price != null &&
      `Price: ${hit.price}${hit.currency ? ` ${hit.currency}` : ''}`,
    crumbs && `Category breadcrumbs: ${crumbs}`,
    hit.sku && `SKU: ${hit.sku}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
