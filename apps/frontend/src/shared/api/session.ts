import { api } from './client'

export type SignInOutcome = 'signed-in' | 'refused' | 'unreachable'

/**
 * The response carries the session cookie; the interface learns who that is by
 * asking afterwards.
 *
 * A refusal says the pair does not match and never which half is wrong — that
 * is the shop's answer, and this does not try to be more precise than it.
 */
export async function signIn(email: string, password: string): Promise<SignInOutcome> {
  try {
    const { data } = await api.POST('/api/sessions', { body: { email, password } })

    return data ? 'signed-in' : 'refused'
  } catch {
    return 'unreachable'
  }
}

/** Ends the session everywhere it was usable, including on other devices. */
export async function signOut(): Promise<void> {
  try {
    await api.DELETE('/api/sessions')
  } catch {
    // The interface forgets the session either way: staying "signed in" after
    // asking to leave is worse than a request nobody heard.
  }
}
