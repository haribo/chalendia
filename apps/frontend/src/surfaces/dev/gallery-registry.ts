/**
 * What the gallery shows, and what it deliberately does not
 * (frontend ADR 0003 § 6).
 *
 * A gallery that drifts from the component set is a museum: it looks like a
 * reference and answers questions that stopped being true months ago. The
 * registry exists so a test can walk `shared/ui/` and fail on anything the
 * gallery forgot — the discipline is enforced, not remembered.
 *
 * An exemption is allowed and must say why. A component with no reason is a
 * component nobody looked at.
 */

/**
 * The families the gallery is grouped by, in the order it shows them — and the
 * order the side menu lists them in, since the menu is derived from this and
 * cannot drift from the page it points at.
 *
 * Grouped by what a component *is*, not by an invented sequence: a list of
 * components has no first and no last, so nothing here is numbered.
 */
export const FAMILIES = [
  /*
   * Not a component: the scale every component consumes. It leads because a
   * reader asking what a piece of text should be needs it before anything
   * else, and because the components below are rendered in it.
   */
  { label: 'Fondations', components: ['Typographie'] },
  { label: 'Disposition', components: ['Stack', 'Grid', 'Page', 'PageTitle'] },
  { label: 'Actions', components: ['Button', 'NavLink'] },
  {
    label: 'Champs',
    components: ['TextField', 'SelectField', 'CheckboxField', 'PasswordField', 'FieldFrame'],
  },
  { label: 'Coquille', components: ['AppBar', 'Drawer', 'LanguagePicker', 'ThemePicker'] },
] as const

/**
 * Sections the gallery renders that are not components in `shared/ui/`. They
 * appear in the menu and carry an anchor like any other, and the registry test
 * knows not to look for a file behind them.
 */
export const NOT_COMPONENTS: readonly string[] = ['Typographie']

/** Every component the gallery renders, by file name without its extension. */
export const SHOWN: readonly string[] = FAMILIES.flatMap((family) =>
  family.components.filter((name) => !NOT_COMPONENTS.includes(name)),
)

/** The anchor a section and its menu entry share. */
export function anchorOf(component: string): string {
  return `component-${component.toLowerCase()}`
}

/**
 * Components the gallery cannot render in isolation, each with the reason.
 *
 * Kept short on purpose: every entry here is a component whose states nobody
 * reviews side by side, which is exactly what the gallery exists to prevent.
 */
export const NOT_SHOWN: Record<string, string> = {
  AppShell:
    'It is the page frame itself — a bar, a body, a scroll container. Rendered inside ' +
    'the gallery it would nest a second application in the first, and what it does is ' +
    'visible on every screen already.',
  Form: 'It carries no chrome of its own: it wires submission and busy state around the ' +
    'fields it wraps. Those fields are shown; a form around them would show nothing more.',
}
