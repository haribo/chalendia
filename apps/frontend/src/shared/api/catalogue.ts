import { api } from './client'
import type { InvalidParam } from './field-errors'
import type { components } from './generated/openapi'

export type NewProduct = components['schemas']['NewProduct']
export type ProductPage = components['schemas']['ProductPage']
export type ProductSummary = components['schemas']['ProductSummary']

export type CatalogueOutcome =
  | { kind: 'listed'; page: ProductPage }
  /** The shop refused fields; the words are the API's, never invented here. */
  | { kind: 'refused'; params?: InvalidParam[] }
  | { kind: 'unreachable' }

/** One page of the catalogue, most recently created first. */
export async function listProducts(page = 1): Promise<CatalogueOutcome> {
  try {
    const { data } = await api.GET('/api/products', { params: { query: { page } } })

    return data ? { kind: 'listed', page: data } : { kind: 'unreachable' }
  } catch {
    return { kind: 'unreachable' }
  }
}

/**
 * Creates a product and answers with the listing the merchant lands on — the
 * shop sends it back, so the interface does not ask twice for what it just
 * changed.
 */
export async function createProduct(product: NewProduct): Promise<CatalogueOutcome> {
  try {
    const { data, error } = await api.POST('/api/products', { body: product })

    if (data) {
      return { kind: 'listed', page: data }
    }

    const problem = error as { 'invalid-params'?: InvalidParam[] } | undefined
    return { kind: 'refused', params: problem?.['invalid-params'] }
  } catch {
    return { kind: 'unreachable' }
  }
}
