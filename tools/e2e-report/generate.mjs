#!/usr/bin/env node
/**
 * Builds the local review site from Playwright's JSON report.
 *
 * The report is what the user looks at to decide whether a screen is right —
 * assertions prove behaviour, this shows the result. Per case: the video, the
 * screenshot of every step, and a review status.
 *
 * The status lives in `reviews.json`, committed, keyed by `<spec>::<title>`,
 * and anchored to a hash of the spec file at review time: when the spec
 * changes, the case returns to "to review", because a validation is a statement
 * about the code it was given for.
 *
 * Input:  apps/frontend/tmp/e2e-report/report.json
 * Output: reports/e2e/ (not committed)
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const INPUT = path.join(ROOT, 'apps/frontend/tmp/e2e-report/report.json')
const REVIEWS = path.join(HERE, 'reviews.json')
const OUT = path.join(ROOT, 'reports/e2e')
const E2E_DIR = path.join(ROOT, 'apps/frontend/e2e')

if (!fs.existsSync(INPUT)) {
  console.error(`No report at ${INPUT} — run the suite first (just e2e).`)
  process.exit(1)
}

const report = JSON.parse(fs.readFileSync(INPUT, 'utf8'))
const reviews = fs.existsSync(REVIEWS) ? JSON.parse(fs.readFileSync(REVIEWS, 'utf8')) : {}

// --- collect -----------------------------------------------------------------

/** Every case in the run, flattened out of Playwright's nested suites. */
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

const collected = []
for (const suite of report.suites ?? []) {
  for (const { spec, file } of cases(suite)) {
    const test = spec.tests?.[0]
    const result = test?.results?.[0]
    const key = `${file}::${spec.title}`
    const review = reviews[key]
    const hash = hashOf(file)

    collected.push({
      key,
      file,
      // The directory under e2e/ is the category — the layout is the taxonomy.
      category: path.dirname(file) === '.' ? 'general' : path.dirname(file),
      title: spec.title,
      ok: spec.ok === true,
      status: statusOf(review, hash),
      note: review?.note,
      reviewedAt: review?.reviewedAt,
      steps: (result?.attachments ?? []).filter((a) => a.name?.startsWith('step: ')),
      video: (result?.attachments ?? []).find((a) => a.contentType === 'video/webm'),
      duration: result?.duration ?? 0,
      error: result?.error?.message,
    })
  }
}

function statusOf(review, hash) {
  if (!review) return 'to-review'
  if (review.specHash && review.specHash !== hash) return 'stale'
  return review.status
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

for (const item of collected) {
  item.videoSrc = copy(item.video)
  item.stepShots = item.steps.map((step) => ({
    name: step.name.replace(/^step: /, ''),
    src: copy(step),
  }))
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

const page = (title, body) => `<!doctype html>
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
</style></head><body><main>${body}</main></body></html>`

fs.mkdirSync(path.join(OUT, 'cases'), { recursive: true })

for (const item of collected) {
  const steps = item.stepShots
    .filter((step) => step.src)
    .map(
      (step, index) => `<figure><img src="../${step.src}" alt="${escape(step.name)}">
<figcaption>${index + 1}. ${escape(step.name)}</figcaption></figure>`,
    )
    .join('\n')

  fs.writeFileSync(
    path.join(OUT, 'cases', `${slug(item.key)}.html`),
    page(
      item.title,
      `<p><a href="../index.html">← every case</a></p>
<h1>${escape(item.title)}</h1>
<p class="muted"><code>${escape(item.file)}</code> · ${(item.duration / 1000).toFixed(1)}s ·
<span class="tag ${item.ok ? 'pass' : 'fail'}">${item.ok ? 'passing' : 'failing'}</span>
<span class="tag ${item.status}">${LABEL[item.status]}</span></p>
${item.note ? `<p class="note">${escape(item.note)}</p>` : ''}
${item.error ? `<pre class="note">${escape(item.error)}</pre>` : ''}
${item.videoSrc ? `<h2>The journey</h2><video src="../${item.videoSrc}" controls muted playsinline></video>` : ''}
<h2>Step by step</h2>
${steps || '<p class="muted">This case reports no steps. Wrap its actions in reportStep to see them here.</p>'}`,
    ),
  )
}

const byCategory = new Map()
for (const item of collected) {
  byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item])
}

const count = (status) => collected.filter((item) => item.status === status).length
const toReview = count('to-review') + count('stale')

const index = [...byCategory.entries()]
  .map(
    ([category, items]) => `<h2>${escape(category)}</h2>` +
      items
        .map(
          (item) => `<div class="case">
<span class="tag ${item.ok ? 'pass' : 'fail'}">${item.ok ? 'passing' : 'failing'}</span>
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
<p class="muted">Generated from the last run. Statuses live in <code>tools/e2e-report/reviews.json</code>.</p>
<div class="summary">
<span><strong>${collected.length}</strong> cases</span>
<span><strong>${collected.filter((item) => item.ok).length}</strong> passing</span>
<span><strong>${toReview}</strong> waiting for review</span>
<span><strong>${count('to-fix')}</strong> to fix</span>
</div>
${index}`,
  ),
)

console.log(`report: ${collected.length} cases, ${toReview} waiting for review → reports/e2e/index.html`)
