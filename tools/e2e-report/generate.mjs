#!/usr/bin/env node
/**
 * Builds the local review site from Playwright's JSON reports.
 *
 * The report is what the user looks at to decide whether a screen is right —
 * assertions prove behaviour, this shows the result. Per case: the video, the
 * screenshot of every step, and a review status.
 *
 * Each journey is replayed once per variant (desktop light, desktop dark, phone)
 * and each run leaves its own report, so a case here is the same journey seen
 * three ways: one page, one toggle. A case that is missing a variant is a hole
 * in the review, so the generator says so and fails.
 *
 * The status lives in `reviews.json`, committed, keyed by `<spec>::<title>`,
 * and anchored to a hash of the spec file at review time: when the spec
 * changes, the case returns to "to review", because a validation is a statement
 * about the code it was given for.
 *
 * Input:  apps/frontend/tmp/e2e-report/report-<variant>.json
 * Output: reports/e2e/ (not committed)
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const INPUT_DIR = path.join(ROOT, 'apps/frontend/tmp/e2e-report')
const REVIEWS = path.join(HERE, 'reviews.json')
const OUT = path.join(ROOT, 'reports/e2e')
const E2E_DIR = path.join(ROOT, 'apps/frontend/e2e')

/** Display order, and the label each variant carries in the report. */
const VARIANTS = {
  'desktop-light': 'desktop · light',
  'desktop-dark': 'desktop · dark',
  'mobile-light': 'mobile',
}

const reports = (fs.existsSync(INPUT_DIR) ? fs.readdirSync(INPUT_DIR) : [])
  .map((file) => ({ file, variant: /^report-(.+)\.json$/.exec(file)?.[1] }))
  .filter((entry) => entry.variant)
  .sort((a, b) => order(a.variant) - order(b.variant))

function order(variant) {
  const index = Object.keys(VARIANTS).indexOf(variant)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

if (reports.length === 0) {
  console.error(`No report in ${INPUT_DIR} — run the suite first (just e2e).`)
  process.exit(1)
}

const reviews = fs.existsSync(REVIEWS) ? JSON.parse(fs.readFileSync(REVIEWS, 'utf8')) : {}

// --- collect -----------------------------------------------------------------

/** Every case in a run, flattened out of Playwright's nested suites. */
function* cases(suite, file = suite.file) {
  for (const spec of suite.specs ?? []) {
    yield { spec, file: spec.file ?? file }
  }
  for (const child of suite.suites ?? []) {
    yield* cases(child, child.file ?? file)
  }
}

const specHashes = new Map()
function hashOf(file) {
  if (!specHashes.has(file)) {
    const full = path.join(E2E_DIR, file)
    const content = fs.existsSync(full) ? fs.readFileSync(full) : Buffer.from(file)
    specHashes.set(file, createHash('sha256').update(content).digest('hex').slice(0, 12))
  }
  return specHashes.get(file)
}

/** One entry per journey, holding what each variant saw of it. */
const collected = new Map()

for (const { file, variant } of reports) {
  const report = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), 'utf8'))

  for (const suite of report.suites ?? []) {
    for (const { spec, file: specFile } of cases(suite)) {
      const result = spec.tests?.[0]?.results?.[0]
      const key = `${specFile}::${spec.title}`

      if (!collected.has(key)) {
        const review = reviews[key]
        const hash = hashOf(specFile)
        collected.set(key, {
          key,
          file: specFile,
          // The directory under e2e/ is the category — the layout is the taxonomy.
          category: path.dirname(specFile) === '.' ? 'general' : path.dirname(specFile),
          title: spec.title,
          status: statusOf(review, hash),
          note: review?.note,
          reviewedAt: review?.reviewedAt,
          runs: new Map(),
        })
      }

      collected.get(key).runs.set(variant, {
        variant,
        ok: spec.ok === true,
        steps: (result?.attachments ?? []).filter((a) => a.name?.startsWith('step: ')),
        video: (result?.attachments ?? []).find((a) => a.contentType === 'video/webm'),
        duration: result?.duration ?? 0,
        error: result?.error?.message,
      })
    }
  }
}

function statusOf(review, hash) {
  if (!review) return 'to-review'
  if (review.specHash && review.specHash !== hash) return 'stale'
  return review.status
}

const items = [...collected.values()]
const variants = reports.map((entry) => entry.variant)

for (const item of items) {
  item.ok = [...item.runs.values()].every((run) => run.ok)
  item.failing = [...item.runs.values()].filter((run) => !run.ok).map((run) => run.variant)
}

// --- copy artefacts ----------------------------------------------------------

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true })

let asset = 0

/**
 * Attachments arrive either as a file on disk (video, failure screenshot) or as
 * base64 in the report itself (anything attached from a step). Both end up as a
 * file the report can point at.
 */
function copy(attachment) {
  if (!attachment) return undefined

  const extension = attachment.contentType === 'video/webm' ? '.webm' : '.png'
  const name = `${String(++asset).padStart(3, '0')}${extension}`
  const target = path.join(OUT, 'assets', name)

  if (attachment.path && fs.existsSync(attachment.path)) {
    fs.copyFileSync(attachment.path, target)
  } else if (attachment.body) {
    fs.writeFileSync(target, Buffer.from(attachment.body, 'base64'))
  } else {
    asset -= 1
    return undefined
  }

  return `assets/${name}`
}

for (const item of items) {
  for (const run of item.runs.values()) {
    run.videoSrc = copy(run.video)
    run.stepShots = run.steps
      .map((step) => ({ name: step.name.replace(/^step: /, ''), src: copy(step) }))
      .filter((step) => step.src)
  }
}

// --- the invariant the report exists for -------------------------------------

/**
 * Every step of every case carries one capture per variant. A silent hole reads
 * as "reviewed" once the reviewer clicks through, which is the one outcome this
 * report must never produce.
 */
const holes = []

for (const item of items) {
  const reference = item.runs.get(variants[0])

  for (const variant of variants) {
    const run = item.runs.get(variant)
    if (!run) {
      holes.push(`${item.key} — no ${variant} run`)
      continue
    }
    if (run.stepShots.length === 0 && run.ok) {
      holes.push(`${item.key} (${variant}) — no captured step, wrap its actions in reportStep`)
    }
    if (run !== reference && run.ok && reference?.ok && run.stepShots.length !== reference.stepShots.length) {
      holes.push(
        `${item.key} (${variant}) — ${run.stepShots.length} steps, ${variants[0]} has ${reference.stepShots.length}`,
      )
    }
  }
}

// --- render ------------------------------------------------------------------

const LABEL = {
  'to-review': 'to review',
  reviewed: 'validated',
  'to-fix': 'to fix',
  stale: 'code changed since review',
}

const escape = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const slug = (key) => createHash('sha256').update(key).digest('hex').slice(0, 10)

const page = (title, body, script = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><style>
:root{color-scheme:light dark;--ink:#171d19;--muted:#5b665f;--bg:#f6f8f5;--card:#fff;--rule:#dde3dd;--accent:#1f6f4a;--danger:#a3242b;--warn:#8a5a00}
@media(prefers-color-scheme:dark){:root{--ink:#e8ede9;--muted:#97a199;--bg:#10140f;--card:#171c18;--rule:#2a3129;--accent:#4fbf88;--danger:#e5737a;--warn:#d9a441}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,sans-serif}
main{max-width:60rem;margin:0 auto;padding:2.5rem 1.25rem 5rem}
h1{font:600 1.9rem/1.15 Georgia,serif;margin:0 0 .3rem}h2{font:600 1.2rem/1.2 Georgia,serif;margin:2rem 0 .6rem}
a{color:var(--accent)}.muted{color:var(--muted)}
.summary{display:flex;gap:1.2rem;flex-wrap:wrap;margin:1rem 0 2rem;font-size:.9rem}
.case{display:flex;gap:.8rem;align-items:baseline;padding:.7rem .9rem;border:1px solid var(--rule);border-radius:8px;background:var(--card);margin-bottom:.5rem}
.case .title{flex:1}
.tag{font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.1rem .5rem;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.tag.to-review{color:var(--warn)}.tag.reviewed{color:var(--accent)}.tag.to-fix{color:var(--danger)}.tag.stale{color:var(--warn)}
.tag.pass{color:var(--accent)}.tag.fail{color:var(--danger)}
figure{margin:0 0 1.5rem}figcaption{font-size:.85rem;color:var(--muted);margin-top:.4rem}
img,video{width:100%;border:1px solid var(--rule);border-radius:8px;background:var(--card)}
.note{border-left:3px solid var(--warn);padding:.5rem .8rem;background:var(--card);border-radius:6px;font-size:.9rem}
code{font-family:ui-monospace,monospace;font-size:.85rem}
.switch{display:flex;gap:.4rem;flex-wrap:wrap;margin:1.5rem 0 0}
.switch button{font:inherit;font-size:.85rem;color:var(--muted);background:var(--card);border:1px solid var(--rule);border-radius:999px;padding:.25rem .9rem;cursor:pointer}
.switch button[aria-pressed=true]{color:var(--bg);background:var(--accent);border-color:var(--accent)}
.switch button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.variant[hidden]{display:none}
.variant[data-variant^=mobile] figure{max-width:24rem}
</style></head><body><main>${body}</main>${script}</body></html>`

/** Keeps the chosen variant while the reviewer walks from case to case. */
const SWITCH_SCRIPT = `<script>
(() => {
  const KEY = 'chalendia-e2e-variant'
  const buttons = [...document.querySelectorAll('.switch button')]
  if (!buttons.length) return
  const show = (variant) => {
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.variant === variant))
    for (const section of document.querySelectorAll('.variant')) section.hidden = section.dataset.variant !== variant
  }
  for (const button of buttons) {
    button.addEventListener('click', () => {
      localStorage.setItem(KEY, button.dataset.variant)
      show(button.dataset.variant)
    })
  }
  const remembered = localStorage.getItem(KEY)
  show(buttons.some((button) => button.dataset.variant === remembered) ? remembered : buttons[0].dataset.variant)
})()
</script>`

fs.mkdirSync(path.join(OUT, 'cases'), { recursive: true })

for (const item of items) {
  const runs = variants.map((variant) => item.runs.get(variant)).filter(Boolean)

  const toggle = `<div class="switch" role="group" aria-label="Variant">
${runs
  .map(
    (run) => `<button type="button" data-variant="${escape(run.variant)}" aria-pressed="false">${escape(
      VARIANTS[run.variant] ?? run.variant,
    )}${run.ok ? '' : ' ✗'}</button>`,
  )
  .join('\n')}
</div>`

  const sections = runs
    .map((run) => {
      const steps = run.stepShots
        .map(
          (step, index) => `<figure><img src="../${step.src}" alt="${escape(step.name)}">
<figcaption>${index + 1}. ${escape(step.name)}</figcaption></figure>`,
        )
        .join('\n')

      return `<section class="variant" data-variant="${escape(run.variant)}" hidden>
<p class="muted">${(run.duration / 1000).toFixed(1)}s ·
<span class="tag ${run.ok ? 'pass' : 'fail'}">${run.ok ? 'passing' : 'failing'}</span></p>
${run.error ? `<pre class="note">${escape(run.error)}</pre>` : ''}
${run.videoSrc ? `<h2>The journey</h2><video src="../${run.videoSrc}" controls muted playsinline></video>` : ''}
<h2>Step by step</h2>
${steps || '<p class="muted">This case reports no steps. Wrap its actions in reportStep to see them here.</p>'}
</section>`
    })
    .join('\n')

  fs.writeFileSync(
    path.join(OUT, 'cases', `${slug(item.key)}.html`),
    page(
      item.title,
      `<p><a href="../index.html">← every case</a></p>
<h1>${escape(item.title)}</h1>
<p class="muted"><code>${escape(item.file)}</code> ·
<span class="tag ${item.ok ? 'pass' : 'fail'}">${item.ok ? 'passing' : 'failing'}</span>
<span class="tag ${item.status}">${LABEL[item.status]}</span></p>
${item.note ? `<p class="note">${escape(item.note)}</p>` : ''}
${toggle}
${sections}`,
      SWITCH_SCRIPT,
    ),
  )
}

const byCategory = new Map()
for (const item of items) {
  byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item])
}

const count = (status) => items.filter((item) => item.status === status).length
const toReview = count('to-review') + count('stale')

const index = [...byCategory.entries()]
  .map(
    ([category, cases]) => `<h2>${escape(category)}</h2>` +
      cases
        .map(
          (item) => `<div class="case">
<span class="tag ${item.ok ? 'pass' : 'fail'}">${item.ok ? 'passing' : `failing: ${escape(item.failing.join(', '))}`}</span>
<span class="title"><a href="cases/${slug(item.key)}.html">${escape(item.title)}</a></span>
<span class="tag ${item.status}">${LABEL[item.status]}</span></div>`,
        )
        .join('\n'),
  )
  .join('\n')

fs.writeFileSync(
  path.join(OUT, 'index.html'),
  page(
    'End-to-end journeys',
    `<h1>End-to-end journeys</h1>
<p class="muted">Generated from the last run, ${variants
      .map((variant) => escape(VARIANTS[variant] ?? variant))
      .join(' · ')}. Statuses live in <code>tools/e2e-report/reviews.json</code>.</p>
<div class="summary">
<span><strong>${items.length}</strong> cases</span>
<span><strong>${variants.length}</strong> variants each</span>
<span><strong>${items.filter((item) => item.ok).length}</strong> passing</span>
<span><strong>${toReview}</strong> waiting for review</span>
<span><strong>${count('to-fix')}</strong> to fix</span>
</div>
${index}`,
  ),
)

console.log(
  `report: ${items.length} cases × ${variants.length} variants, ${toReview} waiting for review → reports/e2e/index.html`,
)

if (holes.length > 0) {
  console.error(`\nThe report has holes — a case nobody can see is a case nobody reviewed:`)
  for (const hole of holes) console.error(`  ${hole}`)
  process.exit(1)
}
