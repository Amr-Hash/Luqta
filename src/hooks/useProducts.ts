import { useLiveQuery } from 'dexie-react-hooks'
import { deleteProduct, listProducts, saveProduct } from '@/db'
import type { Product } from '@/types/product'

export function useProducts() {
  const products = useLiveQuery(() => listProducts(), [])

  return {
    products: products ?? [],
    loading: products === undefined,
    save: (p: Parameters<typeof saveProduct>[0]) => saveProduct(p),
    remove: (id: number) => deleteProduct(id),
  }
}

export type { Product }
