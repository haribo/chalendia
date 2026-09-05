/*
 * Fails when a file sets a font size, weight or family instead of consuming a
 * text style — the rule `docs/design/typography.md` stands on.
 *
 * Before the scale existed the frontend carried eleven distinct combinations of
 * size, weight and family, four different weights on one size, and two
 * `line-height` declarations in total. Nobody decided any of it; each screen
 * picked what looked right on the day it was written. A rule without a check
 * would let that come back one component at a time.
 *
 * Only `src/styles/typography.css` may declare the styles themselves.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SOURCE = join(ROOT, 'src')
const ALLOWED = [join(SOURCE, 'styles', 'typography.css')]

/*
 * `font-size` and `font-weight` are always a deviation. `font-family` is one
 * except for the monospace face, which is orthogonal to the scale: a merchant
 * reference reads as a code at any size, so it modifies a style rather than
 * being one.
 *
 * A `transition` naming `font-size` is not a declaration of it — `FieldFrame`
 * animates its notch — so the property has to be followed by a value.
 */
const DEVIATIONS = [
  { what: 'font-size', offends: (line) => /font-size\s*:/.test(line) },
  { what: 'font-weight', offends: (line) => /font-weight\s*:/.test(line) },
  {
    what: 'font-family',
    // A lookahead here would backtrack over the whitespace and match anyway,
    // which is how the first version of this check waved through every mono
    // declaration it was written to allow.
    offends: (line) => /font-family\s*:/.test(line) && !line.includes('var(--font-mono)'),
  },
]

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
      // A line inside a `transition` names the property without setting it.
      if (/transition/.test(line)) return

      for (const { what, offends } of DEVIATIONS) {
        if (offends(line)) {
          violations.push(`${relative(ROOT, path)}:${index + 1}  ${what}  ${line.trim()}`)
        }
      }
    })
}

if (violations.length > 0) {
  console.error(
    `${violations.length} declaration(s) outside the type scale.\n` +
      'Use a `.text-*` class, or `font: var(--style-*)` in a component’s own CSS.\n' +
      'See docs/design/typography.md.\n',
  )
  for (const violation of violations) {
    console.error(`  ${violation}`)
  }
  process.exit(1)
}

console.log('text styles: every size and weight comes from the scale')
