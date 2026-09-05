import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import Table from '@/shared/ui/Table.vue'
import type { Column, Row } from '@/shared/ui/table'
import { NARROW } from '@/composables/useNarrowScreen'

/** A media query the test drives, since jsdom answers none of its own. */
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: NARROW,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

const Trash = defineComponent({ render: () => h('svg') })

const columns: Column[] = [
  { key: 'title', header: 'Produit' },
  { key: 'reference', header: 'Référence' },
  { key: 'price', header: 'Prix', align: 'end' },
  { key: 'state', header: 'État' },
]

const rows: Row[] = [
  {
    key: 1,
    cells: {
      title: { kind: 'strong', value: 'Savon au miel' },
      reference: { kind: 'code', value: 'SAV-MIEL-100' },
      price: { kind: 'number', value: '6,90 €' },
      state: { kind: 'pill', value: 'Publié', tone: 'accent' },
    },
  },
  {
    key: 2,
    cells: {
      title: { kind: 'strong', value: 'Savon à l’argile' },
      // No reference: the cell says so, not the caller.
      reference: { kind: 'code' },
      price: { kind: 'number', value: '8,20 €' },
      state: { kind: 'pill', value: 'Brouillon' },
    },
  },
]

function table(props: Partial<InstanceType<typeof Table>['$props']> = {}) {
  return mount(Table, {
    props: { columns, rows, empty: 'Aucun produit pour l’instant.', label: 'Produits', ...props },
    global: { stubs: { Stack: { template: '<ul><slot /></ul>' } } },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('Table', () => {
  it('renders each kind of cell as its own shape', () => {
    stubMatchMedia(false)
    const rendered = table()

    expect(rendered.find('.strong').text()).toBe('Savon au miel')
    expect(rendered.find('.code').text()).toBe('SAV-MIEL-100')
    expect(rendered.find('.number').text()).toBe('6,90 €')
    expect(rendered.find('.pill').text()).toBe('Publié')
  })

  it('writes the dash for an absent value, so no caller does', () => {
    stubMatchMedia(false)
    const rendered = table()

    const absent = rendered.findAll('.code').find((cell) => cell.classes('absent'))
    expect(absent?.text()).toBe('—')
  })

  it('renders no pill at all when a state is absent, rather than an empty one', () => {
    stubMatchMedia(false)
    const rendered = table({
      rows: [{ key: 1, cells: { title: { kind: 'strong', value: 'Sans état' }, state: { kind: 'pill' } } }],
    })

    // An outlined pill around a dash reads as a state called "—".
    expect(rendered.find('.pill').exists()).toBe(false)
  })

  it('gives a figure a tabular column and an end alignment', () => {
    stubMatchMedia(false)
    const rendered = table()

    expect(rendered.find('.number').exists()).toBe(true)
    expect(rendered.findAll('td').some((cell) => cell.classes('end'))).toBe(true)
    expect(rendered.findAll('th').some((cell) => cell.classes('end'))).toBe(true)
  })

  it('shows what it does not have instead of headers over nothing', () => {
    stubMatchMedia(false)
    const rendered = table({ rows: [] })

    expect(rendered.find('table').exists()).toBe(false)
    expect(rendered.find('.empty').text()).toBe('Aucun produit pour l’instant.')
  })

  it('renders a table on a wide screen and no cards', () => {
    stubMatchMedia(false)
    const rendered = table()

    expect(rendered.find('table').exists()).toBe(true)
    expect(rendered.find('.cards').exists()).toBe(false)
  })

  it('renders cards on a narrow screen and no table', async () => {
    stubMatchMedia(true)
    const rendered = table()
    await nextTick()

    // Asserted on the DOM, not on the styles: this project has twice shipped a
    // table and cards both in the document with one hidden by CSS, and each
    // time a journey found the same row in two places.
    expect(rendered.find('table').exists()).toBe(false)
    expect(rendered.find('.cards').exists()).toBe(true)
  })

  it('titles a card with the first column and files the rest as metadata', async () => {
    stubMatchMedia(true)
    const rendered = table()
    await nextTick()

    const first = rendered.findAll('li')[0]
    expect(first.find('.strong').text()).toBe('Savon au miel')
    expect(first.find('.meta').text()).toContain('6,90 €')
  })

  it('calls an action, and only the one pressed', async () => {
    stubMatchMedia(false)
    const remove = vi.fn()
    const promote = vi.fn()
    const rendered = table({
      columns: [{ key: 'name', header: 'Taux' }, { key: 'act', header: '' }],
      rows: [
        {
          key: 1,
          cells: {
            name: { kind: 'strong', value: 'Standard' },
            act: {
              kind: 'actions',
              actions: [
                { label: 'Rendre par défaut', onPress: promote },
                { label: 'Supprimer', icon: Trash, onPress: remove },
              ],
            },
          },
        },
      ],
    })

    await rendered.findAll('button')[0].trigger('click')

    expect(promote).toHaveBeenCalledOnce()
    expect(remove).not.toHaveBeenCalled()
  })

  it('names an icon-only action for assistive technology', () => {
    stubMatchMedia(false)
    const rendered = table({
      columns: [{ key: 'act', header: '' }],
      rows: [
        {
          key: 1,
          cells: {
            act: { kind: 'actions', actions: [{ label: 'Supprimer Standard', icon: Trash, onPress: vi.fn() }] },
          },
        },
      ],
    })

    // There is no text to read, so the label has to be announced.
    expect(rendered.find('button').attributes('aria-label')).toBe('Supprimer Standard')
  })

  it('refuses to act through a disabled action', async () => {
    stubMatchMedia(false)
    const onPress = vi.fn()
    const rendered = table({
      columns: [{ key: 'act', header: '' }],
      rows: [
        {
          key: 1,
          cells: { act: { kind: 'actions', actions: [{ label: 'Supprimer', disabled: true, onPress }] } },
        },
      ],
    })

    await rendered.find('button').trigger('click')

    expect(onPress).not.toHaveBeenCalled()
  })

  it('renders a cell a row never filed, rather than failing on it', () => {
    stubMatchMedia(false)
    // A column whose key no row carries: the table shows the absence instead
    // of throwing, since a surface adding a column before its data is a
    // moment that happens.
    const rendered = table({ columns: [...columns, { key: 'ghost', header: 'Absent' }] })

    expect(rendered.findAll('tbody tr')).toHaveLength(2)
    expect(rendered.text()).toContain('—')
  })
})
