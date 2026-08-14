import { api } from './client'
import type { components } from './generated/openapi'

export type Health = components['schemas']['Health']

/** What the dashboard can know about the shop it is administering. */
export type SystemStatus =
  | { kind: 'loading' }
  | { kind: 'reachable'; health: Health }
  /** The API did not answer, so nothing is known about the database either. */
  | { kind: 'unreachable' }

/**
 * A degraded shop answers 503 with a body describing what failed, so the
 * response is a result, not an error: only a request that never landed is one.
 *
 * The client parses that body into `error`, having already consumed the
 * response — reading it again from the raw response throws, which would turn a
 * perfectly readable 503 into "the API is down".
 */
export async function readHealth(): Promise<SystemStatus> {
  try {
    const { data, error } = await api.GET('/api/health')

    if (data) {
      return { kind: 'reachable', health: data }
    }
    if (error) {
      return { kind: 'reachable', health: error as Health }
    }
    return { kind: 'unreachable' }
  } catch {
    return { kind: 'unreachable' }
  }
}
