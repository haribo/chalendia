import { ref } from 'vue'

const STORAGE_KEY = 'chalendia.rail-folded'

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

// Unfolded is the default: the words are what make Catalogue and Content tell
// themselves apart, and folding is a choice the operator makes deliberately.
const folded = ref(read())

export function useFoldedRail() {
  function toggle(): void {
    folded.value = !folded.value
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, String(folded.value))
    } catch {
      // The choice does not survive the session; the rail still folds.
    }
  }

  return { folded, toggle }
}
