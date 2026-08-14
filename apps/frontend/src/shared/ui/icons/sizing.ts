/**
 * The sizes an icon may take. A number written at a call site is a size nobody
 * decided, so the catalogue is closed and the values live here.
 */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg'

export const ICON_SIZE_PX: Record<IconSize, number> = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 32,
}
