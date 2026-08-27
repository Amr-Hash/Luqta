/** Shared price / currency parsing for any ecommerce text. */

function normalizeDigits(raw: string): string {
  const eastern = '٠١٢٣٤٥٦٧٨٩'
  const persian = '۰۱۲۳۴۵۶۷۸۹'
  return raw
    .replace(/[٠-٩]/g, (d) => String(eastern.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
}

const CURRENCY_TOKEN =
  'SAR|USD|EGP|AED|EUR|GBP|KWD|BHD|OMR|QAR|€|\\$|£|ر\\.?\\s?س\\.?|ج\\.?\\s?م\\.?|جنيه|ريال|درهم'

function detectCurrency(text: string): string | null {
  if (/SAR|ر\.?\s?س|ريال/i.test(text)) return 'SAR'
  if (/EGP|ج\.?\s?م|جنيه/i.test(text)) return 'EGP'
  if (/AED|درهم/i.test(text)) return 'AED'
  if (/KWD/i.test(text)) return 'KWD'
  if (/BHD/i.test(text)) return 'BHD'
  if (/OMR/i.test(text)) return 'OMR'
  if (/QAR/i.test(text)) return 'QAR'
  if (/EUR|€/.test(text)) return 'EUR'
  if (/GBP|£/.test(text)) return 'GBP'
  if (/USD|\$/.test(text)) return 'USD'
  return null
}

function toNumber(raw: string | null | undefined): number | null {
  if (!raw) return null
  const n = Number.parseFloat(String(raw).replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Extract the main product price from page / share / catalog text.
 * Handles split lines (جنيه\\n8599.95) and labeled `Price: 8599.95 EGP`.
 */
export function parsePriceAmount(source: string): {
  price: number | null
  currency: string | null
} {
  const text = normalizeDigits(source)

  const labeled = text.match(
    /(?:^|\n)\s*Price:\s*([\d,.]+)\s*([A-Z]{3})?/i,
  )
  if (labeled?.[1]) {
    const price = toNumber(labeled[1])
    const currency =
      (labeled[2] ? labeled[2].toUpperCase() : null) || detectCurrency(text)
    if (price != null && price > 0) return { price, currency }
  }

  const amountRe = new RegExp(
    `(?:${CURRENCY_TOKEN})\\s*([\\d]{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)|([\\d]{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)\\s*(?:${CURRENCY_TOKEN})`,
    'gi',
  )
  const hits = [...text.matchAll(amountRe)]
    .map((m) => toNumber(m[1] ?? m[2]))
    .filter((n): n is number => n != null && n >= 1)

  // Currency then amount on next line
  if (hits.length === 0) {
    const loose = [
      ...text.matchAll(
        new RegExp(`(?:${CURRENCY_TOKEN})\\s*[\\n\\r]+\\s*([\\d]{1,7}(?:\\.\\d+)?)`, 'gi'),
      ),
    ]
      .map((m) => toNumber(m[1]))
      .filter((n): n is number => n != null && n >= 1)
    hits.push(...loose)
  }

  // Prefer a "product-looking" price (>= 20) when many tiny accessory prices exist
  const substantial = hits.filter((n) => n >= 20)
  const price = (substantial[0] ?? hits[0]) ?? null

  return {
    price,
    currency: price != null ? detectCurrency(text) : null,
  }
}
