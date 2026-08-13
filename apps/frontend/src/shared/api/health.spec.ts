import { afterEach, describe, expect, it, vi } from 'vitest'

import { readHealth } from '@/shared/api/health'

/**
 * Exercises the real client against a stubbed transport. Mocking `readHealth`
 * itself would have hidden the defect this file exists for: a 503 carries a
 * readable body, and reading it the wrong way reported the API as down.
 */
function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reading the system status', () => {
  it('reports a healthy shop', async () => {
    respondWith(200, { status: 'ok', service: 'chalendia-backend', database: 'up' })

    expect(await readHealth()).toEqual({
      kind: 'reachable',
      health: { status: 'ok', service: 'chalendia-backend', database: 'up' },
    })
  })

  it('treats a degraded shop as an answer, not a failure', async () => {
    respondWith(503, { status: 'degraded', service: 'chalendia-backend', database: 'unreachable' })

    const result = await readHealth()

    expect(result.kind).toBe('reachable')
    expect(result.kind === 'reachable' && result.health.database).toBe('unreachable')
  })

  it('reports the API as unreachable only when the request never landed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    expect(await readHealth()).toEqual({ kind: 'unreachable' })
  })
})
