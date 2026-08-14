<script setup lang="ts">
/**
 * `close` from Google Material Symbols (Apache-2.0).
 * https://fonts.google.com/icons?selected=Material+Symbols+Outlined:close
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
    <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
  </svg>
</template>
