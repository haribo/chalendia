import { api } from './client'
import type { components } from './generated/openapi'

export type ProductImage = components['schemas']['ProductImage']

/**
 * Why the shop refused, read from the problem's `type` and never from its
 * `detail`: the shop cannot know the reader's language, so the words a merchant
 * sees are this application's (`docs/design/core.md` § 8).
 */
export type ImageRefusal =
  | 'not-jpeg'
  | 'too-small'
  | 'too-large'
  | 'too-heavy'
  | 'too-many'
  | 'no-such-product'
  | 'no-such-image'
  /** The list sent was not exactly the product's images — read them again. */
  | 'not-the-same-images'
  | 'unknown'

export type ImagesOutcome =
  | { kind: 'listed'; images: ProductImage[] }
  | { kind: 'refused'; refusal: ImageRefusal }
  | { kind: 'unreachable' }

export type ImageOutcome =
  | { kind: 'image'; image: ProductImage }
  | { kind: 'refused'; refusal: ImageRefusal }
  | { kind: 'unreachable' }

export type RemovalOutcome =
  | { kind: 'removed' }
  | { kind: 'refused'; refusal: ImageRefusal }
  | { kind: 'unreachable' }

const REFUSALS: Record<string, ImageRefusal> = {
  '/problems/image-not-jpeg': 'not-jpeg',
  '/problems/image-too-small': 'too-small',
  '/problems/image-too-large': 'too-large',
  '/problems/image-too-heavy': 'too-heavy',
  '/problems/too-many-images': 'too-many',
  '/problems/no-such-product': 'no-such-product',
  '/problems/no-such-image': 'no-such-image',
  '/problems/not-the-same-images': 'not-the-same-images',
}

/**
 * An unrecognised problem is `unknown` rather than a crash: a shop newer than
 * this interface may name a refusal this build has never heard of, and the
 * merchant is better served by "the shop refused" than by a blank screen.
 */
function refusalFrom(error: unknown): ImageRefusal {
  const kind = (error as { type?: string } | undefined)?.type
  if (kind === undefined) {
    return 'unknown'
  }

  return REFUSALS[kind] ?? 'unknown'
}

/** Every photograph of one product, in the order they are shown. */
export async function listImages(productId: number): Promise<ImagesOutcome> {
  try {
    const { data, error } = await api.GET('/api/products/{id}/images', {
      params: { path: { id: productId } },
    })

    if (data) {
      return { kind: 'listed', images: data }
    }

    return { kind: 'refused', refusal: refusalFrom(error) }
  } catch {
    return { kind: 'unreachable' }
  }
}

/**
 * Adds one photograph, already uprighted and reduced by `shared/images/prepare`.
 *
 * Multipart, so this one call does not go through the typed client: a `File` is
 * not something an OpenAPI body describes, and building the form by hand is
 * what the shop's own reader expects.
 */
export async function addImage(
  productId: number,
  file: File,
  alternativeText?: string,
): Promise<ImageOutcome> {
  const form = new FormData()
  form.append('file', file, file.name)
  if (alternativeText) {
    form.append('alternativeText', alternativeText)
  }

  try {
    const answer = await globalThis.fetch(
      `${base()}/api/products/${productId}/images`,
      // No `Content-Type`: the browser sets it with the boundary it generated,
      // and a hand-written one leaves the shop unable to split the parts.
      { method: 'POST', body: form, credentials: 'include' },
    )

    if (answer.ok) {
      return { kind: 'image', image: (await answer.json()) as ProductImage }
    }

    return { kind: 'refused', refusal: refusalFrom(await problemOf(answer)) }
  } catch {
    return { kind: 'unreachable' }
  }
}

/** Changes what one photograph says it shows. */
export async function describeImage(
  productId: number,
  imageId: number,
  alternativeText: string | null,
): Promise<ImageOutcome> {
  try {
    const { data, error } = await api.PATCH('/api/products/{id}/images/{imageId}', {
      params: { path: { id: productId, imageId } },
      body: { alternativeText },
    })

    if (data) {
      return { kind: 'image', image: data }
    }

    return { kind: 'refused', refusal: refusalFrom(error) }
  } catch {
    return { kind: 'unreachable' }
  }
}

/** Removes one photograph, and the files the shop stored it as. */
export async function removeImage(
  productId: number,
  imageId: number,
): Promise<RemovalOutcome> {
  try {
    const { error, response } = await api.DELETE('/api/products/{id}/images/{imageId}', {
      params: { path: { id: productId, imageId } },
    })

    if (response.ok) {
      return { kind: 'removed' }
    }

    return { kind: 'refused', refusal: refusalFrom(error) }
  } catch {
    return { kind: 'unreachable' }
  }
}

/**
 * Puts a product's photographs in a given order.
 *
 * The **whole list**, because that is what the shop takes: it refuses a list
 * that is not exactly what it holds, so a page that has gone stale learns it
 * here rather than reordering photographs nobody was looking at.
 */
export async function reorderImages(
  productId: number,
  imageIds: number[],
): Promise<ImagesOutcome> {
  try {
    const { data, error } = await api.PUT('/api/products/{id}/images/order', {
      params: { path: { id: productId } },
      body: { imageIds },
    })

    if (data) {
      return { kind: 'listed', images: data }
    }

    return { kind: 'refused', refusal: refusalFrom(error) }
  } catch {
    return { kind: 'unreachable' }
  }
}

/** The same base the typed client uses, for the one call that cannot go through it. */
function base(): string {
  return import.meta.env.VITE_API_BASE_URL ?? globalThis.location?.origin ?? ''
}

/** A refusal body, or nothing when the shop answered something else entirely. */
async function problemOf(answer: Response): Promise<unknown> {
  try {
    return await answer.json()
  } catch {
    return undefined
  }
}
