/*
 * Reading a Playwright report — the part of the push that can be wrong on its
 * own, and the only part worth testing without a network.
 *
 * The evidence comes from the reports rather than from the artefact directory:
 * the reports carry case titles and step names in words, where the directory
 * carries truncated slugs.
 */

/**
 * One entry per captured step.
 *
 * Screenshots arrive inline, as base64 — Playwright attaches them to the result
 * rather than writing them out.
 */
export function stepsOf(report) {
  return walk(report, (attachment, title) => {
    if (attachment.contentType !== 'image/png' || !attachment.body) {
      return undefined
    }

    // Playwright prefixes a named step and calls the end-of-test one plainly
    // `screenshot`. Left as it comes, a reviewer scrolling a list of named
    // moments meets one called "screenshot" and cannot tell what it is — so it
    // is given the name it deserves here.
    const named = attachment.name.replace(/^step: /, '')

    return {
      case: title,
      step: named === '' || named === 'screenshot' ? 'end of journey' : named,
      bytes: Buffer.from(attachment.body, 'base64'),
    }
  })
}

/**
 * One film per journey.
 *
 * A video comes back as a **path**, not a body: Playwright writes it to disk
 * once the run is over, and a report that inlined it would carry megabytes of
 * base64 for something nobody diffs.
 */
export function filmsOf(report) {
  return walk(report, (attachment, title) =>
    attachment.contentType === 'video/webm' && attachment.path
      ? { case: title, path: attachment.path }
      : undefined,
  )
}

/** Every attachment of every result, with the spec title it belongs to. */
function walk(report, take) {
  const found = []

  const suites = (nodes) => {
    for (const suite of nodes ?? []) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          for (const result of test.results ?? []) {
            for (const attachment of result.attachments ?? []) {
              const entry = take(attachment, spec.title)
              if (entry) {
                found.push(entry)
              }
            }
          }
        }
      }
      suites(suite.suites)
    }
  }

  suites(report.suites)
  return found
}
