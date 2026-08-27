import Dexie, { type EntityTable } from 'dexie'
import type { Product } from '@/types/product'

export class LuqtaDB extends Dexie {
  products!: EntityTable<Product, 'id'>

  constructor() {
    super('luqta')
    this.version(1).stores({
      products: '++id, fingerprint, brand, category, createdAt, updatedAt, title',
    })
  }
}

export const db = new LuqtaDB()

export async function listProducts(): Promise<Product[]> {
  return db.products.orderBy('updatedAt').reverse().toArray()
}

export async function getProduct(id: number): Promise<Product | undefined> {
  return db.products.get(id)
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
