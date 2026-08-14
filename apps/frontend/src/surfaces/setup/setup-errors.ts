import type { components } from '@/shared/api/generated/openapi'

/** Which field a refusal belongs to, and whether it deserves words. */
export interface FieldErrors {
  name?: string
  legalIdentity?: string
  currency?: string
  contentLanguage?: string
  timezone?: string
  administratorEmail?: string
  administratorPassword?: string
}

type InvalidParam = components['schemas']['InvalidParam']

/**
 * The API names every field it refused, and gives words only where the value
 * does not already show the problem. An empty string carries that distinction
 * to the field: invalid, with nothing to add.
 */
export function fieldErrorsFrom(params: InvalidParam[] | undefined): FieldErrors {
  const errors: FieldErrors = {}

  for (const param of params ?? []) {
    // The names are the contract's, so a renamed field breaks the build here
    // rather than silently landing on no field at all.
    if (param.name in EMPTY) {
      errors[param.name as keyof FieldErrors] = param.reason ?? ''
    }
  }

  return errors
}

const EMPTY: Record<keyof FieldErrors, true> = {
  name: true,
  legalIdentity: true,
  currency: true,
  contentLanguage: true,
  timezone: true,
  administratorEmail: true,
  administratorPassword: true,
}
