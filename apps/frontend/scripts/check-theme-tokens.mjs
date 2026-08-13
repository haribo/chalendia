/*
 * Fails when a component writes a colour value instead of referencing a
 * semantic token — the rule ADR 0002 stands on. Without a check, the rule is
 * an intention that survives about a month.
 *
 * Only `src/styles/tokens.css` may hold literal colours: it is where a theme
 * is defined.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SOURCE = join(ROOT, 'src')
const ALLOWED = [join(SOURCE, 'styles', 'tokens.css')]

// #abc, #aabbcc, rgb(), rgba(), hsl(), hsla() — the ways a colour gets written.
const COLOUR = /(#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla)\()/gi

function* files(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      yield* files(path)
    } else if (/\.(vue|css)$/.test(path)) {
      yield path
    }
  }
}

const violations = []

for (const path of files(SOURCE)) {
  if (ALLOWED.includes(path)) {
    continue
  }

  readFileSync(path, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      for (const match of line.matchAll(COLOUR)) {
        violations.push(`${relative(ROOT, path)}:${index + 1}  ${match[0]}  ${line.trim()}`)
      }
    })
}

if (violations.length > 0) {
  console.error(`${violations.length} hard-coded colour value(s); use a semantic token:\n`)
  for (const violation of violations) {
    console.error(`  ${violation}`)
  }
  process.exit(1)
}

console.log('theme tokens: no hard-coded colour outside src/styles/tokens.css')
