import type { AppLanguage } from '@/types/product'
import type { ProductSignals } from '@/lib/productSignals'
import {
  fetchNoonCatalog,
  parseNoonProductUrl,
} from '@/lib/noonCatalog'

export type ShopEnricher = {
  id: string
  match: (url: string) => boolean
  enrich: (
    url: string,
    language: AppLanguage,
  ) => Promise<Partial<ProductSignals> | null>
}

const noonEnricher: ShopEnricher = {
  id: 'noon',
  match: (url) => Boolean(parseNoonProductUrl(url)),
  async enrich(url) {
    const hit = await fetchNoonCatalog(url)
    if (!hit) return null
    return {
      title: hit.title,
      brand: hit.brand,
      price: hit.price,
      currency: hit.currency,
      breadcrumbs: hit.breadcrumbs,
      sku: hit.sku,
      confidence: hit.price != null ? 0.85 : 0.6,
    }
  },
}

/** Optional per-shop gap-fillers. Main path stays JSON-LD / OG / heuristics. */
export const SHOP_ENRICHERS: ShopEnricher[] = [noonEnricher]

export async function enrichFromShops(
  url: string,
  language: AppLanguage,
): Promise<Partial<ProductSignals> | null> {
  for (const enricher of SHOP_ENRICHERS) {
    if (!enricher.match(url)) continue
    try {
      const patch = await enricher.enrich(url, language)
      if (patch) return patch
    } catch {
      /* try next */
    }
  }
  return null
}
