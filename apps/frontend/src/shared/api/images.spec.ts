/**
 * Exercises the real client against a stubbed transport. What is under test is
 * the translation of the shop's answers — a refusal kind read from `type`, a
 * body read or not read — and the shape of what leaves; the network is not.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addImage,
  describeImage,
  listImages,
  removeImage,
  reorderImages,
} from '@/shared/api/images'

interface Sent {
  headers: Headers
  /** What was handed to `fetch`, before any transport touched it. */
  body: BodyInit | null | undefined
}

function respondWith(status: number, body?: unknown) {
  const calls: Sent[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request | string, init?: RequestInit) => {
      // The outgoing body is kept as it was passed rather than re-read from a
      // reconstructed Request: undici will not give a FormData back, and a test
      // that cannot see what left would prove nothing about the multipart.
      calls.push(
        input instanceof Request
          ? { headers: input.headers, body: await input.clone().text() }
          : { headers: new Headers(init?.headers), body: init?.body },
      )

      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
      })
    }),
  )

  return calls
}

/** The JSON a call carried, whichever way it was sent. */
function jsonOf(sent: Sent): unknown {
  return JSON.parse(typeof sent.body === 'string' ? sent.body : '')
}

function formOf(sent: Sent): FormData {
  if (!(sent.body instanceof FormData)) {
    throw new Error('the call did not carry a form')
  }

  return sent.body
}

const A_PHOTOGRAPH = {
  id: 7,
  reference: '0123456789abcdef0123456789abcdef',
  position: 0,
  alternativeText: null,
  state: 'pending',
  width: 2400,
  height: 1600,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listing a product’s photographs', () => {
  it('answers with them in the order the shop gave', async () => {
    respondWith(200, [A_PHOTOGRAPH])

    expect(await listImages(3)).toEqual({ kind: 'listed', images: [A_PHOTOGRAPH] })
  })

  it('reports a product that does not exist as a refusal, not as a failure', async () => {
    respondWith(404, { type: '/problems/no-such-product', title: 'Not Found', status: 404 })

    expect(await listImages(3)).toEqual({ kind: 'refused', refusal: 'no-such-product' })
  })

  it('reports the shop as unreachable only when the request never landed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))

    expect(await listImages(3)).toEqual({ kind: 'unreachable' })
  })
})

describe('adding a photograph', () => {
  it('sends the file as multipart, and lets the browser set the boundary', async () => {
    const calls = respondWith(201, A_PHOTOGRAPH)
    const file = new File([new Uint8Array([1, 2, 3])], 'savon.jpg', { type: 'image/jpeg' })

    const outcome = await addImage(3, file, 'Savon au miel')

    expect(outcome).toEqual({ kind: 'image', image: A_PHOTOGRAPH })
    // A hand-written Content-Type would carry no boundary, and the shop could
    // not split the parts — so this client must not set one at all.
    expect(calls[0].headers.get('content-type')).toBeNull()
    const sent = formOf(calls[0])
    expect((sent.get('file') as File).name).toBe('savon.jpg')
    expect(sent.get('alternativeText')).toBe('Savon au miel')
  })

  it('omits the alternative text rather than sending an empty one', async () => {
    const calls = respondWith(201, A_PHOTOGRAPH)
    const file = new File([new Uint8Array([1])], 'savon.jpg', { type: 'image/jpeg' })

    await addImage(3, file, '')

    expect(formOf(calls[0]).has('alternativeText')).toBe(false)
  })

  it('names each refusal the shop can answer with', async () => {
    const file = new File([new Uint8Array([1])], 'savon.jpg', { type: 'image/jpeg' })

    for (const [type, refusal] of [
      ['/problems/image-not-jpeg', 'not-jpeg'],
      ['/problems/image-too-small', 'too-small'],
      ['/problems/image-too-large', 'too-large'],
      ['/problems/image-too-heavy', 'too-heavy'],
      ['/problems/too-many-images', 'too-many'],
    ] as const) {
      respondWith(422, { type, title: 'Unprocessable Entity', status: 422 })

      expect(await addImage(3, file)).toEqual({ kind: 'refused', refusal })
    }
  })

  it('calls a problem it has never heard of unknown rather than crashing', async () => {
    // A shop newer than this build may name a refusal this code does not know,
    // and "the shop refused" serves a merchant better than a blank screen.
    respondWith(422, { type: '/problems/something-new', title: 'Unprocessable Entity', status: 422 })
    const file = new File([new Uint8Array([1])], 'savon.jpg', { type: 'image/jpeg' })

    expect(await addImage(3, file)).toEqual({ kind: 'refused', refusal: 'unknown' })
  })
})

describe('describing a photograph', () => {
  it('sends what it is told, and answers with the image as it now reads', async () => {
    const calls = respondWith(200, { ...A_PHOTOGRAPH, alternativeText: 'Savon au miel' })

    const outcome = await describeImage(3, 7, 'Savon au miel')

    expect(outcome).toEqual({
      kind: 'image',
      image: { ...A_PHOTOGRAPH, alternativeText: 'Savon au miel' },
    })
    expect(jsonOf(calls[0])).toEqual({ alternativeText: 'Savon au miel' })
  })

  it('sends null to take a description away', async () => {
    // Null and not "": the shop stores absent either way, but a client that
    // cannot express "none" would have to remove the photograph to clear it.
    const calls = respondWith(200, A_PHOTOGRAPH)

    await describeImage(3, 7, null)

    expect(jsonOf(calls[0])).toEqual({ alternativeText: null })
  })
})

describe('removing a photograph', () => {
  it('takes a body-less answer as done', async () => {
    // 204 carries nothing, and a client waiting for JSON would read a failure
    // where the shop said success.
    respondWith(204)

    expect(await removeImage(3, 7)).toEqual({ kind: 'removed' })
  })

  it('reports an image the product does not hold', async () => {
    respondWith(404, { type: '/problems/no-such-image', title: 'Not Found', status: 404 })

    expect(await removeImage(3, 7)).toEqual({ kind: 'refused', refusal: 'no-such-image' })
  })
})

describe('reordering photographs', () => {
  it('sends the whole list', async () => {
    const calls = respondWith(200, [A_PHOTOGRAPH])

    await reorderImages(3, [9, 7, 8])

    expect(jsonOf(calls[0])).toEqual({ imageIds: [9, 7, 8] })
  })

  it('reports a list the shop no longer recognises', async () => {
    // The page has gone stale — a photograph landed or left while it was read.
    respondWith(409, { type: '/problems/not-the-same-images', title: 'Conflict', status: 409 })

    expect(await reorderImages(3, [9, 7])).toEqual({
      kind: 'refused',
      refusal: 'not-the-same-images',
    })
  })
})
