import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import fr from '@/i18n/locales/fr.json'
import type { ProductImage } from '@/shared/api/images'
import ProductPhotographs from '@/surfaces/admin/ProductPhotographs.vue'

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } })

const listImages = vi.fn()
const addImage = vi.fn()
const describeImage = vi.fn()
const removeImage = vi.fn()
const reorderImages = vi.fn()
vi.mock('@/shared/api/images', () => ({
  listImages: (...a: unknown[]) => listImages(...a),
  addImage: (...a: unknown[]) => addImage(...a),
  describeImage: (...a: unknown[]) => describeImage(...a),
  removeImage: (...a: unknown[]) => removeImage(...a),
  reorderImages: (...a: unknown[]) => reorderImages(...a),
}))

/**
 * The preparation is stubbed, not exercised: it needs a canvas and
 * `createImageBitmap`, which jsdom has neither of. What this file tests is the
 * screen's own decisions — which files go up, what a refusal says, what is
 * locked and when — and a real canvas would prove none of them.
 */
const prepare = vi.fn()
vi.mock('@/shared/images/prepare', () => ({
  prepare: (...a: unknown[]) => prepare(...a),
  SMALLEST_LONG_SIDE: 800,
  LONG_SIDE: 2400,
  JPEG: 'image/jpeg',
  fit: (size: unknown) => size,
}))

function photograph(over: Partial<ProductImage> = {}): ProductImage {
  return {
    id: 1,
    reference: '0123456789abcdef0123456789abcdef',
    position: 0,
    alternativeText: 'Savon au miel',
    state: 'ready',
    width: 2400,
    height: 1600,
    ...over,
  }
}

function aFile(name = 'savon.jpg') {
  return new File([new Uint8Array([1])], name, { type: 'image/jpeg' })
}

async function screen(images: ProductImage[] = []) {
  listImages.mockResolvedValue({ kind: 'listed', images })
  const wrapper = mount(ProductPhotographs, {
    props: { productId: 3 },
    // The trail carries a NavLink; what it points at is the router's business,
    // and this file is about the screen's own decisions.
    global: { plugins: [i18n], stubs: { NavLink: { template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  for (const stub of [listImages, addImage, describeImage, removeImage, reorderImages, prepare]) {
    stub.mockReset()
  }
  prepare.mockImplementation(async (file: File) => ({
    kind: 'ready',
    file,
    width: 2400,
    height: 1600,
  }))
})

describe('the photographs of a product', () => {
  it('asks the shop for them, and counts them against the ceiling', async () => {
    const wrapper = await screen([photograph(), photograph({ id: 2 })])

    expect(listImages).toHaveBeenCalledWith(3)
    expect(wrapper.text()).toContain('2 sur 10')
  })

  it('offers somewhere to drop files when there are none', async () => {
    const wrapper = await screen()

    expect(wrapper.findComponent({ name: 'DropZone' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('800 px minimum')
  })

  it('counts the photographs still waiting for a description', async () => {
    const wrapper = await screen([
      photograph(),
      photograph({ id: 2, alternativeText: null }),
      // Blank is missing too: a space is not a description of anything.
      photograph({ id: 3, alternativeText: '   ' }),
    ])

    expect(wrapper.text()).toContain('2 photographies attendent')
  })
})

describe('adding photographs', () => {
  it('sends every file the merchant picked', async () => {
    const wrapper = await screen()
    addImage.mockResolvedValue({ kind: 'image', image: photograph() })

    await wrapper.findComponent({ name: 'FilePicker' }).vm.$emit('picked', [aFile('a.jpg'), aFile('b.jpg')])
    await flushPromises()

    expect(addImage).toHaveBeenCalledTimes(2)
  })

  it('sends the valid files of a batch even when one is refused', async () => {
    // Refusing nine photographs because a tenth is too small makes a merchant
    // start over for a mistake the other nine did not make.
    const wrapper = await screen()
    prepare.mockImplementation(async (file: File) =>
      file.name === 'trop-petite.jpg'
        ? { kind: 'refused', refusal: { kind: 'too-small', longSide: 640 }, name: file.name }
        : { kind: 'ready', file, width: 2400, height: 1600 },
    )
    addImage.mockResolvedValue({ kind: 'image', image: photograph() })

    await wrapper
      .findComponent({ name: 'FilePicker' })
      .vm.$emit('picked', [aFile('trop-petite.jpg'), aFile('bonne.jpg')])
    await flushPromises()

    expect(addImage).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('640 px sur le grand côté')
    expect(wrapper.text()).toContain('trop-petite.jpg')
  })

  it('names the file the shop refused, in the reader’s language', async () => {
    // The words are this application's: the shop cannot know who is reading.
    const wrapper = await screen()
    addImage.mockResolvedValue({ kind: 'refused', refusal: 'not-jpeg' })

    await wrapper.findComponent({ name: 'FilePicker' }).vm.$emit('picked', [aFile('etiquette.png')])
    await flushPromises()

    expect(wrapper.text()).toContain('etiquette.png')
    expect(wrapper.text()).toContain('n’est pas un JPEG')
  })

  it('says the shop did not answer rather than blaming the file', async () => {
    const wrapper = await screen()
    addImage.mockResolvedValue({ kind: 'unreachable' })

    await wrapper.findComponent({ name: 'FilePicker' }).vm.$emit('picked', [aFile()])
    await flushPromises()

    expect(wrapper.text()).toContain('n’a pas répondu')
  })

  it('takes files dropped on the zone as if they had been picked', async () => {
    const wrapper = await screen()
    addImage.mockResolvedValue({ kind: 'image', image: photograph() })

    await wrapper.findComponent({ name: 'DropZone' }).vm.$emit('dropped', [aFile()])
    await flushPromises()

    expect(addImage).toHaveBeenCalledTimes(1)
  })
})

describe('ordering', () => {
  it('sends the whole list, not a move', async () => {
    const wrapper = await screen([photograph({ id: 1 }), photograph({ id: 2 })])
    reorderImages.mockResolvedValue({
      kind: 'listed',
      images: [photograph({ id: 2 }), photograph({ id: 1 })],
    })

    await wrapper.findAllComponents({ name: 'PhotographCard' })[1].vm.$emit('moveBack')
    await flushPromises()

    expect(reorderImages).toHaveBeenCalledWith(3, [2, 1])
  })

  it('puts back what the shop holds when it refuses the order', async () => {
    // The page had gone stale. Leaving the merchant looking at an order nobody
    // stored is worse than the refusal itself.
    const held = [photograph({ id: 1 }), photograph({ id: 2 }), photograph({ id: 9 })]
    const wrapper = await screen([photograph({ id: 1 }), photograph({ id: 2 })])
    reorderImages.mockResolvedValue({ kind: 'refused', refusal: 'not-the-same-images' })
    listImages.mockResolvedValue({ kind: 'listed', images: held })

    await wrapper.findAllComponents({ name: 'PhotographCard' })[1].vm.$emit('moveBack')
    await flushPromises()

    expect(wrapper.text()).toContain('La liste a changé')
    // Read again, so what is on screen is what the shop actually holds.
    expect(wrapper.findAllComponents({ name: 'PhotographCard' })).toHaveLength(3)
  })
})

describe('describing and removing', () => {
  it('tells the shop what a photograph now says it shows', async () => {
    const wrapper = await screen([photograph({ id: 4 })])
    describeImage.mockResolvedValue({
      kind: 'image',
      image: photograph({ id: 4, alternativeText: 'Savon au miel sur un linge' }),
    })

    await wrapper.findComponent({ name: 'PhotographCard' }).vm.$emit('describe', 'Savon au miel sur un linge')
    await flushPromises()

    expect(describeImage).toHaveBeenCalledWith(3, 4, 'Savon au miel sur un linge')
  })

  it('asks before removing, and removes nothing until it is confirmed', async () => {
    const wrapper = await screen([photograph({ id: 4 })])

    await wrapper.findComponent({ name: 'PhotographCard' }).vm.$emit('remove')
    await flushPromises()

    expect(wrapper.text()).toContain('Retirer cette photographie ?')
    expect(removeImage).not.toHaveBeenCalled()
  })

  it('removes it once the question is answered', async () => {
    const wrapper = await screen([photograph({ id: 4 })])
    removeImage.mockResolvedValue({ kind: 'removed' })

    await wrapper.findComponent({ name: 'PhotographCard' }).vm.$emit('remove')
    await flushPromises()
    // The real element, found by what it says — which is what a merchant does.
    const confirm = wrapper.findAll('button').find((button) => button.text() === 'Retirer')
    await confirm!.trigger('click')
    await flushPromises()

    expect(removeImage).toHaveBeenCalledWith(3, 4)
    expect(wrapper.findAllComponents({ name: 'PhotographCard' })).toHaveLength(0)
  })

  it('leaves the photograph alone when the question is declined', async () => {
    const wrapper = await screen([photograph({ id: 4 })])

    await wrapper.findComponent({ name: 'PhotographCard' }).vm.$emit('remove')
    await flushPromises()
    const cancel = wrapper.findAll('button').find((button) => button.text() === 'Annuler')
    await cancel!.trigger('click')
    await flushPromises()

    expect(removeImage).not.toHaveBeenCalled()
    expect(wrapper.findAllComponents({ name: 'PhotographCard' })).toHaveLength(1)
  })
})
