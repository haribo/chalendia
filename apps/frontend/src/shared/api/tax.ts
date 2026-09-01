import { api } from './client'
import type { InvalidParam } from './field-errors'
import type { components } from './generated/openapi'

export type VatRate = components['schemas']['VatRate']
export type NewVatRate = components['schemas']['NewVatRate']

export type RatesOutcome =
  | { kind: 'listed'; rates: VatRate[] }
  /** The shop refused fields; the words are the API's, never invented here. */
  | { kind: 'refused'; params?: InvalidParam[] }
  /** Products carry it, and the shop says how many rather than which. */
  | { kind: 'in-use'; products: number }
  | { kind: 'unreachable' }

export async function listRates(): Promise<RatesOutcome> {
  try {
    const { data } = await api.GET('/api/vat-rates')

    return data ? { kind: 'listed', rates: data } : { kind: 'unreachable' }
  } catch {
    return { kind: 'unreachable' }
  }
}

export async function addRate(rate: NewVatRate): Promise<RatesOutcome> {
  try {
    const { data, error } = await api.POST('/api/vat-rates', { body: rate })

    if (data) {
      return { kind: 'listed', rates: data }
    }

    const problem = error as { 'invalid-params'?: InvalidParam[] } | undefined
    return { kind: 'refused', params: problem?.['invalid-params'] }
  } catch {
    return { kind: 'unreachable' }
  }
}

export async function removeRate(id: number): Promise<RatesOutcome> {
  try {
    const { error, response } = await api.DELETE('/api/vat-rates/{id}', {
      params: { path: { id } },
    })

    if (response.status === 409) {
      // A number, not a sentence: the shop does not know the reader's language.
      return { kind: 'in-use', products: (error as { dependents?: number } | undefined)?.dependents ?? 0 }
    }
    if (!response.ok) {
      return { kind: 'unreachable' }
    }

    return listRates()
  } catch {
    return { kind: 'unreachable' }
  }
}

export async function makeDefault(id: number): Promise<RatesOutcome> {
  try {
    const { data } = await api.PUT('/api/vat-rates/{id}/default', {
      params: { path: { id } },
    })

    return data ? { kind: 'listed', rates: data } : { kind: 'unreachable' }
  } catch {
    return { kind: 'unreachable' }
  }
}
