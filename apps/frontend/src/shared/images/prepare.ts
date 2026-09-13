/**
 * What a photograph goes through between the file a merchant picks and the
 * bytes the shop receives (`docs/design/catalog.md` § 5).
 *
 * Three steps, and their order is the design's, not an implementation detail:
 * upright, reduce, convert. A camera writes pixels as its sensor read them and
 * records which way up the picture is beside them; converting to JPEG here
 * drops that note, so a photograph not uprighted at that moment can never be
 * uprighted again.
 *
 * The drawing itself belongs to the browser, and jsdom has neither a canvas nor
 * `createImageBitmap` — so what is unit-tested here is `fit`, which is the part
 * that can be wrong arithmetically. That the result is an upright JPEG is
 * proven by a journey against a real browser, never by a fake canvas: a test
 * that mocks the thing it is testing proves nothing (`docs/delivery-workflow.md`
 * § 4).
 */

/** The shop keeps nothing larger, and refuses a source that is. */
export const LONG_SIDE = 2400

/** Below this the large size would be an upscale, so the shop refuses it. */
export const SMALLEST_LONG_SIDE = 800

/** What the shop accepts, and the only thing this module produces. */
export const JPEG = 'image/jpeg'

/**
 * Quality of the conversion. High enough that a re-encode is not visible on a
 * product photograph, low enough that the upload is not the merchant's wait.
 */
const QUALITY = 0.9

export interface Size {
  width: number
  height: number
}

/**
 * The size a photograph is reduced to, keeping its ratio.
 *
 * A photograph already within the limit is returned **unchanged**, down to the
 * exact numbers: re-encoding a file that needs nothing costs quality for no
 * reason, and a caller comparing the two sizes can tell there is nothing to do.
 */
export function fit(size: Size, longSide = LONG_SIDE): Size {
  const longest = Math.max(size.width, size.height)
  if (longest <= longSide) {
    return size
  }

  const scale = longSide / longest
  // Rounded, then floored to at least one: a sliver of a photograph is still a
  // photograph, and a zero would make a canvas throw.
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  }
}

/** Why a file never reached the shop, said in the merchant's terms. */
export type PreparationRefusal =
  /** Not a picture this browser can decode — a renamed document, most often. */
  | { kind: 'unreadable' }
  /** Smaller than the shop serves, so the large size would be an upscale. */
  | { kind: 'too-small'; longSide: number }

export type Preparation =
  | { kind: 'ready'; file: File; width: number; height: number }
  | { kind: 'refused'; refusal: PreparationRefusal; name: string }

/**
 * Uprights a photograph, reduces it to what the shop keeps, and converts it to
 * JPEG with transparency flattened onto white.
 *
 * Refuses what the shop would refuse anyway, so a merchant learns it from the
 * file they picked rather than from an upload that travelled first. The shop
 * still enforces every limit itself — a client sends whatever it wants.
 */
export async function prepare(file: File): Promise<Preparation> {
  let bitmap: ImageBitmap
  try {
    // `from-image` is what turns the sensor's pixels the right way up. Without
    // it the browser hands back the raw orientation and the note is lost at the
    // conversion below.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return { kind: 'refused', refusal: { kind: 'unreadable' }, name: file.name }
  }

  const longest = Math.max(bitmap.width, bitmap.height)
  if (longest < SMALLEST_LONG_SIDE) {
    bitmap.close()
    return {
      kind: 'refused',
      refusal: { kind: 'too-small', longSide: longest },
      name: file.name,
    }
  }

  const size = fit({ width: bitmap.width, height: bitmap.height })
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return { kind: 'refused', refusal: { kind: 'unreadable' }, name: file.name }
  }

  // White first, then the photograph over it: a canvas starts transparent, and
  // JPEG has no transparency to carry it. Without this a cut-out product comes
  // out black rather than on the white the design promises.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, JPEG, QUALITY),
  )
  if (!blob) {
    return { kind: 'refused', refusal: { kind: 'unreadable' }, name: file.name }
  }

  return {
    kind: 'ready',
    file: new File([blob], jpegName(file.name), { type: JPEG }),
    width: size.width,
    height: size.height,
  }
}

/**
 * The name the shop is told, with the extension the bytes now deserve.
 *
 * A `.png` carrying JPEG bytes is what the shop already refuses on its own
 * reading of the content, and it would be this interface that had lied.
 */
function jpegName(name: string): string {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name

  return `${stem}.jpg`
}
