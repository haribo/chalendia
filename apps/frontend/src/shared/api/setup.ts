import { api } from './client'
import type { components } from './generated/openapi'

export type SetupRequest = components['schemas']['SetupRequest']

export type InvalidParam = components['schemas']['InvalidParam']

export type SetupOutcome =
  | { kind: 'configured'; name?: string }
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
    const { data, error, response } = await api.POST('/setup', { body: request })

    if (data) {
      return { kind: 'configured', name: data.name ?? undefined }
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
