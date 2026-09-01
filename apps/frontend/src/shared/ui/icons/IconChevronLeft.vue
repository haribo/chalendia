<script setup lang="ts">
/**
 * `chevron_left` from Google Material Symbols (Apache-2.0).
 * https://fonts.google.com/icons?selected=Material+Symbols+Outlined:chevron_left
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
    <path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" />
  </svg>
</template>
