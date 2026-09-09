<script setup lang="ts">
/**
 * `hourglass` from Google Material Symbols (Apache-2.0).
 * https://fonts.google.com/icons?selected=Material+Symbols+Outlined:hourglass
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
    <path d="M320-160h320v-120q0-66-47-113t-113-47q-66 0-113 47t-47 113v120Zm0-480v-120h320v120q0 66-47 113t-113 47q-66 0-113-47t-47-113ZM200-80v-80h40v-120q0-61 28.5-114.5T348-480q-51-32-79.5-85.5T240-680v-120h-40v-80h560v80h-40v120q0 61-28.5 114.5T612-480q51 32 79.5 85.5T720-280v120h40v80H200Z" />
  </svg>
</template>
