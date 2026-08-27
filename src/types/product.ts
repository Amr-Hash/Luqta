export type AppLanguage = 'ar' | 'en'

export interface ProductSpecs {
  [key: string]: string | number | boolean | null
}

export interface ExtractedProduct {
  title: string
  brand: string | null
  price: number | null
  currency: string | null
  category: string | null
  specs: ProductSpecs
  summary: string | null
  language: AppLanguage
}

export interface Product extends ExtractedProduct {
  id?: number
  sourceUrl: string | null
  sourceText: string | null
  imageUrl: string | null
  fingerprint: string
  createdAt: number
  updatedAt: number
}

export interface SimilarityMatch {
  product: Product
  score: number
  reason: 'duplicate' | 'similar'
}

export interface SharePayload {
  title: string
  text: string
  url: string
}
