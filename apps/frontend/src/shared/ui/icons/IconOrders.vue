<script setup lang="ts">
/**
 * `local_shipping` from Google Material Symbols (Apache-2.0).
 * https://fonts.google.com/icons?selected=Material+Symbols+Outlined:local_shipping
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
    <path d="M240-160q-50 0-85-35t-35-85H40v-440q0-33 23.5-56.5T120-800h560v160h120l120 160v200h-80q0 50-35 85t-85 35q-50 0-85-35t-35-85H360q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T280-280q0-17-11.5-28.5T240-320q-17 0-28.5 11.5T200-280q0 17 11.5 28.5T240-240Zm480 0q17 0 28.5-11.5T760-280q0-17-11.5-28.5T720-320q-17 0-28.5 11.5T680-280q0 17 11.5 28.5T720-240ZM680-560h170l-90-120h-80v120Z" />
  </svg>
</template>
