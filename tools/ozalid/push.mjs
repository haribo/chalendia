#!/usr/bin/env node
/*
 * Pushes the journeys' captures to ozalid, where they are reviewed.
 *
 * Run locally, after `just e2e`, and **before** opening a pull request: the
 * visual result is one of the two things this project says cannot be
 * self-granted (CLAUDE.md), and a capture reaching CI is a capture nobody
 * looked at in time.
 *
 * The evidence comes from Playwright's own reports rather than from the
 * artefact directory: the reports carry the case titles and the step names in
 * words, where the directory carries truncated slugs.
 *
 * What changed is not computed here. Every capture is hashed, ozalid is asked
 * which addresses it does not hold, and what it does not hold is exactly what
 * changed — content addressing answers the question for us.
 */

import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const ROOT = new URL('../..', import.meta.url).pathname
const REPORTS = join(ROOT, 'apps/frontend/tmp/e2e-report')
/*
 * Which ozalid case each journey is, committed to the repository.
 *
 * ozalid generates a case's id and says the client stores it and never invents
 * one. Matching on the title instead would open a second case the day somebody
 * rewords a test — silently, and with the history left behind on the old one.
 * Keeping the map in git makes a rename visible in review, where it is fixed by
 * editing one line rather than by losing a case.
 */
const CASES = join(ROOT, 'tools/ozalid/cases.json')

/** Shows what would be sent, and writes nothing anywhere. */
const DRY = process.argv.includes('--dry-run')

const BASE = process.env.OZALID_URL
const TOKEN = process.env.OZALID_TOKEN
const PROJECT = process.env.OZALID_PROJECT ?? 'chalendia'

if (!BASE || !TOKEN) {
  console.error('OZALID_URL and OZALID_TOKEN are required — see .env.example')
  process.exit(1)
}

/**
 * A variant, as the axes this project renders on.
 *
 * ozalid ships no list of axes and never invents one: they are created by
 * first use, and their order is what a variant's label reads from.
 */
function axesOf(variant) {
  const [viewport, theme] = variant.split('-')
  return { viewport, theme }
}

async function call(path, options = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(options.body && !options.raw ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  return response
}

/** Walks a Playwright report and yields one entry per captured step. */
function stepsOf(report) {
  const found = []

  const walk = (suites) => {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          for (const result of test.results ?? []) {
            for (const attachment of result.attachments ?? []) {
              if (attachment.contentType !== 'image/png' || !attachment.body) continue
              found.push({
                case: spec.title,
                // Playwright prefixes a named step; the bare `screenshot` is
                // the end-of-test one, which is a moment like any other.
                step: attachment.name.replace(/^step: /, '') || 'end of journey',
                bytes: Buffer.from(attachment.body, 'base64'),
              })
            }
          }
        }
      }
      walk(suite.suites)
    }
  }

  walk(report.suites)
  return found
}

const files = (await readdir(REPORTS)).filter((name) => /^report-.+\.json$/.test(name))
if (files.length === 0) {
  console.error(`no report in ${REPORTS} — run \`just e2e\` first`)
  process.exit(1)
}

// case title → step name → variant → bytes
const book = new Map()
const blobs = new Map()

for (const file of files) {
  const variant = file.replace(/^report-|\.json$/g, '')
  const report = JSON.parse(await readFile(join(REPORTS, file), 'utf8'))

  for (const entry of stepsOf(report)) {
    const hash = `sha256:${createHash('sha256').update(entry.bytes).digest('hex')}`
    blobs.set(hash, entry.bytes)

    const steps = book.get(entry.case) ?? new Map()
    const captures = steps.get(entry.step) ?? []
    captures.push({ variant: axesOf(variant), hash })
    steps.set(entry.step, captures)
    book.set(entry.case, steps)
  }
}

console.log(`${book.size} cases, ${blobs.size} distinct captures across ${files.length} variants`)

// ── The cases, by the map this repository keeps ───────────────────────────
const stored = await readFile(CASES, 'utf8').then(JSON.parse).catch(() => ({}))
const byTitle = new Map(Object.entries(stored))

const missing = [...book.keys()].filter((title) => !byTitle.has(title))
const unused = [...byTitle.keys()].filter((title) => !book.has(title))

if (unused.length > 0) {
  // Not an error: a journey may be temporarily skipped. Said out loud, because
  // the other reading is that somebody reworded a test and is about to open a
  // duplicate case.
  console.warn(`\n${unused.length} case(s) in the map that this run did not produce:`)
  for (const title of unused) console.warn(`  ${byTitle.get(title)}  ${title}`)
  console.warn('If one was renamed, edit tools/ozalid/cases.json rather than opening a second case.\n')
}

if (DRY) {
  console.log(`\nwould open ${missing.length} case(s):`)
  for (const title of missing) console.log(`  ${title}`)
  let absent = 0
  for (const hash of blobs.keys()) {
    const held = await call(`/projects/${PROJECT}/blobs/${hash}`, { method: 'HEAD' })
    if (!held.ok) absent += 1
  }
  console.log(`\nwould send ${absent} of ${blobs.size} captures — the rest is already held`)
  console.log(`would push an edition of ${book.size} cases`)
  process.exit(0)
}

const categories = await (await call(`/projects/${PROJECT}/categories`)).json()
let categoryId = categories[0]?.id

if (!categoryId) {
  const made = await call(`/projects/${PROJECT}/categories`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Journeys' }),
  })
  if (!made.ok) {
    console.error(`cannot open a category: ${made.status} ${await made.text()}`)
    process.exit(1)
  }
  categoryId = (await made.json()).id
  console.log(`opened category "Journeys"`)
}

for (const title of missing) {

  const made = await call(`/projects/${PROJECT}/cases`, {
    method: 'POST',
    body: JSON.stringify({ title, categoryId }),
  })
  if (!made.ok) {
    console.error(`cannot open case "${title}": ${made.status} ${await made.text()}`)
    process.exit(1)
  }
  const opened = await made.json()
  byTitle.set(title, opened.id)
  console.log(`opened case ${opened.id}  ${title}`)
}

// Written before the edition: a case opened and forgotten is a case that gets
// opened twice on the next run.
await writeFile(CASES, `${JSON.stringify(Object.fromEntries(byTitle), undefined, 2)}\n`)

// ── Upload only what the store does not hold ──────────────────────────────
let sent = 0
for (const [hash, bytes] of blobs) {
  const held = await call(`/projects/${PROJECT}/blobs/${hash}`, { method: 'HEAD' })
  if (held.ok) continue

  const put = await call(`/projects/${PROJECT}/blobs/${hash}`, {
    method: 'PUT',
    body: bytes,
    raw: true,
    headers: { 'Content-Type': 'image/png' },
  })
  if (!put.ok) {
    console.error(`cannot send ${hash}: ${put.status} ${await put.text()}`)
    process.exit(1)
  }
  sent += 1
}

console.log(
  sent === 0
    ? 'nothing changed: the store already holds every capture'
    : `${sent} capture(s) changed and were sent`,
)

// ── The manifest ──────────────────────────────────────────────────────────
const manifest = {
  revision: process.env.OZALID_REVISION ?? 'working tree',
  cases: [...book].map(([title, steps]) => ({
    id: byTitle.get(title),
    steps: [...steps].map(([name, captures]) => ({ name, captures })),
  })),
}

const pushed = await call(`/projects/${PROJECT}/editions`, {
  method: 'POST',
  body: JSON.stringify(manifest),
})

if (!pushed.ok) {
  console.error(`intake refused: ${pushed.status}`)
  console.error(await pushed.text())
  process.exit(1)
}

const accepted = await pushed.json()
console.log(
  `edition ${accepted.editionId}: ${accepted.cases} cases, ${accepted.captures} captures`,
)
console.log(`review it at ${BASE}/projects/${PROJECT}`)
