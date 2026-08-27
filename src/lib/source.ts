/** Friendly shop / marketplace name from a product URL. */

const KNOWN: { re: RegExp; id: string; en: string; ar: string }[] = [
  { re: /amazon\./i, id: 'amazon', en: 'Amazon', ar: 'أمازون' },
  { re: /noon\./i, id: 'noon', en: 'Noon', ar: 'نون' },
  { re: /jumia\./i, id: 'jumia', en: 'Jumia', ar: 'جوميا' },
  { re: /ebay\./i, id: 'ebay', en: 'eBay', ar: 'إيباي' },
  { re: /aliexpress\./i, id: 'aliexpress', en: 'AliExpress', ar: 'علي إكسبرس' },
  { re: /shein\./i, id: 'shein', en: 'SHEIN', ar: 'شي إن' },
  { re: /trendyol\./i, id: 'trendyol', en: 'Trendyol', ar: 'ترينديول' },
  { re: /namshi\./i, id: 'namshi', en: 'Namshi', ar: 'نمشي' },
  { re: /extra\./i, id: 'extra', en: 'Extra', ar: 'إكسترا' },
  { re: /jarir\./i, id: 'jarir', en: 'Jarir', ar: 'جرير' },
  { re: /hajarafa\./i, id: 'hajarafa', en: 'Haj Arafa', ar: 'حاج عرفة' },
  { re: /myshopx\.|ruh\.myshopx/i, id: 'ruh', en: 'RUH', ar: 'روح' },
  { re: /shopify\.com|myshopify\.com/i, id: 'shopify', en: 'Shopify store', ar: 'متجر شوبيفاي' },
]

export type ProductSource = {
  id: string
  label: string
  host: string
}

export function sourceFromUrl(
  url: string | null | undefined,
  language: 'ar' | 'en' = 'en',
): ProductSource | null {
  if (!url?.trim()) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    for (const row of KNOWN) {
      if (row.re.test(host) || row.re.test(url)) {
        return {
          id: row.id,
          label: language === 'ar' ? row.ar : row.en,
          host,
        }
      }
    }
    const base = host.split('.').slice(-2).join('.')
    const name = host.split('.')[0] || host
    const pretty = name.charAt(0).toUpperCase() + name.slice(1)
    return { id: base || host, label: pretty, host }
  } catch {
    return null
  }
}

export function sourceKey(url: string | null | undefined): string {
  return sourceFromUrl(url)?.id ?? 'unknown'
}
