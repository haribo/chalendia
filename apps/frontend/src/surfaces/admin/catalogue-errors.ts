import { fieldErrorsFrom as mapRefusals, type InvalidParam } from '@/shared/api/field-errors'

/** Which field a refusal belongs to, and whether it deserves words. */
export interface ProductErrors {
  title?: string
  price?: string
  state?: string
}

const KNOWN: Record<keyof ProductErrors, true> = {
  title: true,
  price: true,
  state: true,
}

/** The product form's share of the shared mapping. */
export function productErrorsFrom(params: InvalidParam[] | undefined): ProductErrors {
  return mapRefusals(params, KNOWN)
}
