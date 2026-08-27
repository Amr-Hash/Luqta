import Dexie, { type EntityTable } from 'dexie'
import type { Product } from '@/types/product'
import { findFirstUrl, sourceFromUrl } from '@/lib/source'

export class LuqtaDB extends Dexie {
  products!: EntityTable<Product, 'id'>

  constructor() {
    super('luqta')
    this.version(1).stores({
      products: '++id, fingerprint, brand, category, createdAt, updatedAt, title',
    })
    this.version(2).stores({
      products:
        '++id, fingerprint, brand, category, sourceDomain, createdAt, updatedAt, title',
    })
  }
}

export const db = new LuqtaDB()

function backfillSourceFields(product: Product): Product {
  if (product.sourceDomain?.trim()) return product

  const url =
    product.sourceUrl ||
    findFirstUrl(product.sourceText) ||
    (typeof product.specs?.source === 'string'
      ? findFirstUrl(String(product.specs.source))
      : null) ||
    null

  const src = sourceFromUrl(url)
  if (!src) return product

  const next: Product = {
    ...product,
    sourceUrl: product.sourceUrl || url,
    sourceDomain: src.domain,
    sourceLabel: src.label,
  }

  if (product.id != null) {
    void db.products.update(product.id, {
      sourceUrl: next.sourceUrl,
      sourceDomain: next.sourceDomain,
      sourceLabel: next.sourceLabel,
    })
  }

  return next
}

export async function listProducts(): Promise<Product[]> {
  const rows = await db.products.orderBy('updatedAt').reverse().toArray()
  return rows.map(backfillSourceFields)
}

export async function getProduct(id: number): Promise<Product | undefined> {
  const row = await db.products.get(id)
  return row ? backfillSourceFields(row) : undefined
}

export async function saveProduct(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: number
    createdAt?: number
    updatedAt?: number
  },
): Promise<number> {
  const now = Date.now()
  if (product.id != null) {
    await db.products.update(product.id, { ...product, updatedAt: now })
    return product.id
  }
  const id = await db.products.add({
    ...product,
    createdAt: now,
    updatedAt: now,
  })
  if (typeof id !== 'number') {
    throw new Error('Failed to save product')
  }
  return id
}

export async function deleteProduct(id: number): Promise<void> {
  await db.products.delete(id)
}

export async function findByFingerprint(
  fingerprint: string,
): Promise<Product | undefined> {
  return db.products.where('fingerprint').equals(fingerprint).first()
}
