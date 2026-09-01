import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

/** The threshold the back office adapts at (`docs/design/core.md` § 8). */
export const NARROW = '(max-width: 47.999rem)'

/**
 * Whether the screen is narrow enough that a surface should change shape
 * rather than shrink.
 *
 * For layouts CSS cannot express alone — a table becoming cards is not one
 * element restyled but two different structures, and rendering both to hide
 * one puts every row in the document twice.
 */
export function useNarrowScreen() {
  const narrow = ref(false)
  let query: MediaQueryList | undefined

  function onChange(event: MediaQueryListEvent): void {
    narrow.value = event.matches
  }

  onMounted(() => {
    query = globalThis.matchMedia?.(NARROW)
    if (!query) return

    narrow.value = query.matches
    query.addEventListener('change', onChange)
  })

  onBeforeUnmount(() => query?.removeEventListener('change', onChange))

  return { narrow: readonly(narrow) }
}
