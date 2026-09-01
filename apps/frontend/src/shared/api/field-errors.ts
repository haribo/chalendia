import type { components } from '@/shared/api/generated/openapi'

export type InvalidParam = components['schemas']['InvalidParam']

/**
 * Turns the API's list of refused fields into something a form can hand to its
 * fields, one at a time.
 *
 * The API names every field it refused, and gives words only where the value
 * does not already show the problem. An empty string carries that distinction
 * to the field: invalid, with nothing to add.
 *
 * `known` is the set of names the surface has a field for. A refusal naming
 * anything else is dropped rather than shown against the wrong control — and
 * because the set is typed, a field renamed in the contract breaks the build
 * instead of silently landing nowhere.
 */
export function fieldErrorsFrom<Name extends string>(
  params: InvalidParam[] | undefined,
  known: Record<Name, true>,
): Partial<Record<Name, string>> {
  const errors: Partial<Record<Name, string>> = {}

  for (const param of params ?? []) {
    if (param.name in known) {
      errors[param.name as Name] = param.reason ?? ''
    }
  }

  return errors
}
