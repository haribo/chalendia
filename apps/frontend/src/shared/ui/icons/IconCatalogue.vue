<script setup lang="ts">
/**
 * `shopping_bag` from Google Material Symbols (Apache-2.0).
 * https://fonts.google.com/icons?selected=Material+Symbols+Outlined:shopping_bag
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
    <path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm240-640q-33 0-56.5 23.5T400-640h160q0-33-23.5-56.5T480-720Z" />
  </svg>
</template>
