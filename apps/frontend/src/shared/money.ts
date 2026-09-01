/**
 * Amounts are held as integer minor units of the shop currency
 * (`docs/design/core.md` § 5). Nothing here does arithmetic on them — that is
 * the shop's job — it only crosses the boundary between what is stored and
 * what a person reads or types.
 */

/** How many minor units make one major one, for this currency. */
export function minorDigits(currency: string, locale: string): number {
  try {
    return (
      new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    )
  } catch {
    // An unknown currency code is the shop's problem, not a crash here.
    return 2
  }
}

/** Formatted for the reader's interface locale, in the shop's currency. */
export function formatAmount(minor: number, currency: string, locale: string): string {
  const digits = minorDigits(currency, locale)

  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
      minor / 10 ** digits,
    )
  } catch {
    return String(minor / 10 ** digits)
  }
}

/**
 * Reads what someone typed. Both separators are accepted because both are
 * typed: a French keyboard writes 6,90 and a numeric keypad writes 6.90, and
 * refusing either would be refusing the person, not the value.
 *
 * Returns undefined for anything that is not a number — the caller decides
 * what to say about it, and the shop refuses it in the end either way.
 */
export function parseAmount(typed: string, currency: string, locale: string): number | undefined {
  const cleaned = typed.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned)) {
    return undefined
  }

  const major = Number(cleaned)
  if (!Number.isFinite(major)) {
    return undefined
  }

  // Rounded rather than truncated: 6.90 times 100 is 689.9999… in binary
  // floating point, and a cent lost here is a cent wrong in every order.
  return Math.round(major * 10 ** minorDigits(currency, locale))
}
