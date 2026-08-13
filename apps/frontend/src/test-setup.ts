/*
 * Node 26 defines a native `localStorage` global that stays disabled unless the
 * runtime is started with `--localstorage-file`. Because the name already
 * exists, the test environment does not copy jsdom's own implementation over
 * it, and anything reading a stored preference fails on the environment rather
 * than on the code under test.
 *
 * A browser always provides Storage, so supplying one here tests the same code
 * path a real visitor exercises.
 */
class MemoryStorage implements Storage {
  private entries = new Map<string, string>()

  get length(): number {
    return this.entries.size
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value))
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
  }
}

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  })
}
