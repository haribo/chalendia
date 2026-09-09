<script setup lang="ts">
/**
 * `warning` from Google Material Symbols (Apache-2.0).
 * https://fonts.google.com/icons?selected=Material+Symbols+Outlined:warning
 */
import { ICON_SIZE_PX, type IconSize } from './sizing'

withDefaults(defineProps<{ size?: IconSize }>(), { size: 'sm' })
</script>

<template>
  <svg
    :width="ICON_SIZE_PX[size]"
    :height="ICON_SIZE_PX[size]"
    viewBox="0 -960 960 960"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="m40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z" />
  </svg>
</template>
