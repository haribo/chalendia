import { api } from './client'
import type { components } from './generated/openapi'

export type SetupRequest = components['schemas']['SetupRequest']

export type InvalidParam = components['schemas']['InvalidParam']

export type SetupOutcome =
  | { kind: 'configured'; name?: string; currency?: string }
  /** The shop refused fields; the words are the API's, never invented here. */
  | { kind: 'refused'; params?: InvalidParam[] }
  | { kind: 'already-configured' }
  | { kind: 'unreachable' }

/**
 * Creates the shop and its first administrator, and signs that administrator
 * in — the session cookie rides on the response.
 */
export async function runSetup(request: SetupRequest): Promise<SetupOutcome> {
  try {
    const { data, error, response } = await api.POST('/api/setup', { body: request })

    if (data) {
      // The currency comes back with the shop, and every price the merchant
      // is about to see needs it. Waiting for the next page load to learn it
      // is how an amount ends up shown in minor units.
      return { kind: 'configured', name: data.name ?? undefined, currency: data.currency ?? undefined }
    }
    if (response.status === 409) {
      return { kind: 'already-configured' }
    }

    const problem = error as { 'invalid-params'?: InvalidParam[] } | undefined
    return { kind: 'refused', params: problem?.['invalid-params'] }
  } catch {
    return { kind: 'unreachable' }
  }
}
