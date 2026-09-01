import { fieldErrorsFrom as mapRefusals, type InvalidParam } from '@/shared/api/field-errors'

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

const KNOWN: Record<keyof FieldErrors, true> = {
  name: true,
  legalIdentity: true,
  currency: true,
  contentLanguage: true,
  timezone: true,
  administratorEmail: true,
  administratorPassword: true,
}

/** The setup form's share of the shared mapping. */
export function fieldErrorsFrom(params: InvalidParam[] | undefined): FieldErrors {
  return mapRefusals(params, KNOWN)
}
