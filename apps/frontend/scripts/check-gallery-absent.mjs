#!/usr/bin/env node
/*
 * Fails when the design-system gallery reaches the production build.
 *
 * The route is guarded by `import.meta.env.DEV`, which the bundler replaces
 * with `false` and then eliminates. That is a claim about a build tool, and a
 * claim about a build tool is worth exactly as much as the check that reads
 * the output — a Vite upgrade, or a stray import from a shipped file, would
 * put the gallery into every merchant's installation with nothing to say so.
 *
 * Run after `vite build`, on `dist/`.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const DIST = new URL('../dist/', import.meta.url).pathname

/** What the gallery leaves behind if it is bundled: its path, and its own words. */
const FINGERPRINTS = ['/dev/design-system', 'DesignSystemView', 'GallerySpecimen', 'gallery-registry']

async function everyFile(directory) {
  const found = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    found.push(...(entry.isDirectory() ? await everyFile(path) : [path]))
  }
  return found
}

let files
try {
  files = await everyFile(DIST)
} catch {
  console.error('no dist/ to check — run the build first')
  process.exit(1)
}

const guilty = []
for (const file of files.filter((name) => /\.(js|css|html)$/.test(name))) {
  const content = await readFile(file, 'utf8')
  const hits = FINGERPRINTS.filter((mark) => content.includes(mark))
  if (hits.length > 0) guilty.push({ file: file.slice(DIST.length), hits })
}

if (guilty.length > 0) {
  console.error('the design-system gallery reached the production build:')
  for (const { file, hits } of guilty) console.error(`  ${file} — ${hits.join(', ')}`)
  process.exit(1)
}

console.log(`design system: absent from ${files.length} built files`)
