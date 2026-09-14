import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DropZone from '@/shared/ui/DropZone.vue'
import FilePicker from '@/shared/ui/FilePicker.vue'

function aFile(name = 'savon.jpg') {
  return new File([new Uint8Array([1])], name, { type: 'image/jpeg' })
}

/**
 * jsdom has no `DataTransfer`, so the two things a browser would hand over are
 * built by hand: a `FileList` on the input, and a carrier on the drop event.
 */
function asFileList(files: File[]): FileList {
  return Object.assign(files.slice(), {
    item: (at: number) => files[at] ?? null,
  }) as unknown as FileList
}

function withFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: asFileList(files), configurable: true })

  return input
}

function carrying(files: File[]) {
  return { dataTransfer: { files: asFileList(files) } }
}

describe('FilePicker', () => {
  it('says what it is for on a real button', () => {
    const picker = mount(FilePicker, { props: { label: 'Choisir des photographies' } })

    expect(picker.get('button').text()).toBe('Choisir des photographies')
  })

  it('keeps the browser’s input out of sight and out of the tab order', () => {
    // A file input renders differently in every browser and carries a label
    // nobody wrote; the button is what a merchant sees and reaches.
    const input = mount(FilePicker, { props: { label: 'Ajouter' } }).get('input')

    expect(input.attributes('tabindex')).toBe('-1')
    expect(input.attributes('aria-hidden')).toBe('true')
  })

  it('hands over the files that were chosen', async () => {
    const picker = mount(FilePicker, { props: { label: 'Ajouter', multiple: true } })
    const input = picker.get('input').element as HTMLInputElement

    withFiles(input, [aFile('a.jpg'), aFile('b.jpg')])
    await picker.get('input').trigger('change')

    expect(picker.emitted('picked')).toHaveLength(1)
    expect((picker.emitted('picked')![0][0] as File[]).map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
  })

  it('clears itself, so the same file picked twice is still an event', async () => {
    // A merchant who fixed a photograph and picked it again expects it to go.
    const picker = mount(FilePicker, { props: { label: 'Ajouter' } })
    const input = picker.get('input').element as HTMLInputElement

    withFiles(input, [aFile()])
    await picker.get('input').trigger('change')

    expect(input.value).toBe('')
  })

  it('says nothing when the merchant closed the picker without choosing', async () => {
    const picker = mount(FilePicker, { props: { label: 'Ajouter' } })

    await picker.get('input').trigger('change')

    expect(picker.emitted('picked')).toBeUndefined()
  })

  it('passes what it cannot promise down to the browser', () => {
    // `accept` is the browser's own filter and never a guarantee — the shop
    // checks the bytes whatever a client sends.
    const picker = mount(FilePicker, {
      props: { label: 'Ajouter', accept: 'image/*', multiple: true },
    })

    expect(picker.get('input').attributes('accept')).toBe('image/*')
    expect(picker.get('input').attributes('multiple')).toBeDefined()
  })

  it('disables the button and the input together', () => {
    const picker = mount(FilePicker, { props: { label: 'Ajouter', disabled: true } })

    expect(picker.get('button').attributes('disabled')).toBeDefined()
    expect(picker.get('input').attributes('disabled')).toBeDefined()
  })
})

describe('DropZone', () => {
  it('hands over what was dropped on it', async () => {
    const zone = mount(DropZone)

    await zone.trigger('drop', carrying([aFile()]))

    expect(zone.emitted('dropped')).toHaveLength(1)
  })

  it('takes nothing when disabled', async () => {
    const zone = mount(DropZone, { props: { disabled: true } })

    await zone.trigger('drop', carrying([aFile()]))

    expect(zone.emitted('dropped')).toBeUndefined()
  })

  it('says nothing when a drag carried no file', async () => {
    const zone = mount(DropZone)

    await zone.trigger('drop', carrying([]))

    expect(zone.emitted('dropped')).toBeUndefined()
  })

  it('stays lit while the pointer crosses what it contains', async () => {
    // Depth, not a flag: dragging over a child fires `dragleave` on the parent,
    // and a boolean would blink the zone off every time the pointer crossed the
    // button inside it.
    const zone = mount(DropZone)

    await zone.trigger('dragenter')
    await zone.trigger('dragenter')
    expect(zone.classes()).toContain('over')

    await zone.trigger('dragleave')
    expect(zone.classes()).toContain('over')

    await zone.trigger('dragleave')
    expect(zone.classes()).not.toContain('over')
  })

  it('goes out once something is dropped', async () => {
    const zone = mount(DropZone)

    await zone.trigger('dragenter')
    await zone.trigger('drop', carrying([aFile()]))

    expect(zone.classes()).not.toContain('over')
  })
})
