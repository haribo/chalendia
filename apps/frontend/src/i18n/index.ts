import { createI18n } from 'vue-i18n'

import en from './locales/en.json'
import fr from './locales/fr.json'

export const SUPPORTED_LOCALES = ['en', 'fr'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const FALLBACK_LOCALE: Locale = 'en'
const STORAGE_KEY = 'chalendia.locale'

export function isSupported(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale)
}

/**
 * An explicit choice wins; otherwise the browser decides, matching on the
 * language subtag so `fr-CA` finds `fr`. Falls back rather than showing keys.
 */
export function resolveInitialLocale(
  stored: string | null,
  preferred: readonly string[] = [],
): Locale {
  if (isSupported(stored)) {
    return stored
  }

  for (const candidate of preferred) {
    const subtag = candidate.split('-')[0]
    if (isSupported(subtag)) {
      return subtag
    }
  }

  return FALLBACK_LOCALE
}

export function readStoredLocale(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    // Private browsing modes can throw on access; a missing preference is not
    // a reason to fail loading the shop.
    return null
  }
}

export function storeLocale(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale)
  } catch {
    // Same: the choice simply does not survive the session.
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(readStoredLocale(), globalThis.navigator?.languages ?? []),
  fallbackLocale: FALLBACK_LOCALE,
  messages: { en, fr },
})

/** Changes the interface language, remembers it, and tells assistive tech. */
export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  storeLocale(locale)
  document.documentElement.setAttribute('lang', locale)
}
