import { readonly, ref } from 'vue'

export const THEME_CHOICES = ['system', 'light', 'dark'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]

const STORAGE_KEY = 'chalendia.theme'

function isChoice(value: string | null): value is ThemeChoice {
  return THEME_CHOICES.includes(value as ThemeChoice)
}

function read(): ThemeChoice {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
    return isChoice(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

const choice = ref<ThemeChoice>(read())

/**
 * `system` removes the attribute so the tokens follow `prefers-color-scheme`;
 * an explicit choice stamps the root and overrides it, in both directions.
 */
function apply(value: ThemeChoice): void {
  const root = document.documentElement
  if (value === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', value)
  }
}

export function setTheme(value: ThemeChoice): void {
  choice.value = value
  apply(value)
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value)
  } catch {
    // The choice does not survive the session; the interface still works.
  }
}

export function useTheme() {
  return { choice: readonly(choice), setTheme }
}

/** Called once at startup, before the first paint, to avoid a flash. */
export function initTheme(): void {
  apply(choice.value)
}
