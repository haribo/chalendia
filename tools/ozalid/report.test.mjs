import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { filmsOf, stepsOf } from './report.mjs'

/**
 * Playwright nests suites by file and by describe block, so a reader that only
 * looked one level down would find the journeys of a bare spec and miss every
 * journey inside a `test.describe` — which is all of them here.
 */
function aReport({ attachments = [], title = 'a journey', depth = 2 } = {}) {
  let suite = { specs: [{ title, tests: [{ results: [{ attachments }] }] }] }
  for (let level = 1; level < depth; level += 1) {
    suite = { specs: [], suites: [suite] }
  }

  return { suites: [suite] }
}

const shot = (name, body = 'AAAA') => ({ contentType: 'image/png', name, body })
const film = (path) => ({ contentType: 'video/webm', name: 'video', path })

describe('reading the steps of a report', () => {
  it('finds a journey however deeply the suites nest it', () => {
    for (const depth of [1, 2, 3, 4]) {
      const steps = stepsOf(aReport({ attachments: [shot('step: Signing in')], depth }))

      assert.equal(steps.length, 1, `not found at depth ${depth}`)
      assert.equal(steps[0].case, 'a journey')
    }
  })

  it('takes the step name out of what Playwright prefixed', () => {
    const [entry] = stepsOf(aReport({ attachments: [shot('step: The list is empty')] }))

    assert.equal(entry.step, 'The list is empty')
  })

  it('names the end-of-test screenshot rather than leaving it blank', () => {
    // Playwright attaches one under the bare name `screenshot`; it is a moment
    // like any other, and an unnamed step would read as a hole in the journey.
    const [entry] = stepsOf(aReport({ attachments: [shot('screenshot')] }))

    assert.equal(entry.step, 'end of journey')
  })

  it('decodes the bytes rather than passing the base64 on', () => {
    const [entry] = stepsOf(aReport({ attachments: [shot('step: x', 'aGVsbG8=')] }))

    assert.ok(Buffer.isBuffer(entry.bytes))
    assert.equal(entry.bytes.toString(), 'hello')
  })

  it('ignores an attachment with no body', () => {
    // A trace or a path-only attachment is not a capture, and pushing one under
    // a capture's address would put an unreadable blob in front of a reviewer.
    const steps = stepsOf(
      aReport({ attachments: [{ contentType: 'image/png', name: 'step: x', path: '/tmp/x.png' }] }),
    )

    assert.deepEqual(steps, [])
  })

  it('leaves the films to the other reader', () => {
    assert.deepEqual(stepsOf(aReport({ attachments: [film('/tmp/a.webm')] })), [])
  })
})

describe('reading the films of a report', () => {
  it('keeps the path, because a video is written out rather than inlined', () => {
    const [entry] = filmsOf(aReport({ attachments: [film('/tmp/journey/video.webm')] }))

    assert.equal(entry.case, 'a journey')
    assert.equal(entry.path, '/tmp/journey/video.webm')
  })

  it('finds a film however deeply the suites nest it', () => {
    for (const depth of [1, 2, 3]) {
      assert.equal(filmsOf(aReport({ attachments: [film('/tmp/a.webm')], depth })).length, 1)
    }
  })

  it('ignores a film Playwright never finished writing', () => {
    const films = filmsOf(aReport({ attachments: [{ contentType: 'video/webm', name: 'video' }] }))

    assert.deepEqual(films, [])
  })

  it('leaves the screenshots to the other reader', () => {
    assert.deepEqual(filmsOf(aReport({ attachments: [shot('step: x')] })), [])
  })

  it('yields one film per journey of the same report', () => {
    const report = {
      suites: [
        {
          specs: [],
          suites: [
            { specs: [{ title: 'one', tests: [{ results: [{ attachments: [film('/a.webm')] }] }] }] },
            { specs: [{ title: 'two', tests: [{ results: [{ attachments: [film('/b.webm')] }] }] }] },
          ],
        },
      ],
    }

    assert.deepEqual(
      filmsOf(report).map((f) => `${f.case}:${f.path}`),
      ['one:/a.webm', 'two:/b.webm'],
    )
  })
})
