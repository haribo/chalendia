import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Page from '@/shared/ui/Page.vue'

describe('Page', () => {
  it('renders its title as the page heading', () => {
    const page = mount(Page, { props: { title: 'Catalogue' } })

    // One `h1`, and it is the title: a screen with two of them, or none, is a
    // screen whose outline is wrong for whoever navigates by headings.
    const headings = page.findAll('h1')
    expect(headings).toHaveLength(1)
    expect(headings[0].text()).toBe('Catalogue')
  })

  it('composes the shared heading rather than restating its style', () => {
    const page = mount(Page, { props: { title: 'Catalogue' } })

    // The type scale of a title lives in exactly one file. If this class is
    // gone, someone has inlined the heading here.
    expect(page.find('h1').classes()).toContain('title')
  })

  it('says nothing under the title when there is nothing to say', () => {
    const page = mount(Page, { props: { title: 'Catalogue' } })

    expect(page.find('.description').exists()).toBe(false)
  })

  it('shows a description when the screen needs one', () => {
    const page = mount(Page, {
      props: { title: 'Réglages', description: 'La langue et le thème de cette installation.' },
    })

    expect(page.find('.description').text()).toBe('La langue et le thème de cette installation.')
  })

  it('puts an action beside the title, not above the content', () => {
    const page = mount(Page, {
      props: { title: 'Catalogue' },
      slots: { action: '<button type="button">Ajouter un produit</button>' },
    })

    // Beside: the action acts on the screen the title names, and a reader
    // scanning the heading finds it without looking further down.
    const header = page.find('h1').element.parentElement
    expect(header?.textContent).toContain('Ajouter un produit')
  })

  it('renders the screen itself in its default slot', () => {
    const page = mount(Page, {
      props: { title: 'Catalogue' },
      slots: { default: '<p>Aucun produit pour l\'instant.</p>' },
    })

    expect(page.text()).toContain("Aucun produit pour l'instant.")
  })
})
