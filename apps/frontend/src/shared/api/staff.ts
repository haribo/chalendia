import { api } from './client'
import type { components } from './generated/openapi'

export type StaffIdentity = components['schemas']['StaffIdentity']

/**
 * Who the shop says is signed in, or nobody.
 *
 * The session lives in a cookie the browser cannot read, so the only way to
 * know is to ask — which also means the answer is the server's, not a claim the
 * interface makes about itself.
 */
export async function readStaff(): Promise<StaffIdentity | null> {
  try {
    const { data } = await api.GET('/staff/me')

    return data ?? null
  } catch {
    return null
  }
}
