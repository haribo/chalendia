<script setup lang="ts">
import PageTitle from '@/shared/ui/PageTitle.vue'
import Stack from '@/shared/ui/Stack.vue'

/**
 * What every surface is: a title, sometimes an action beside it, sometimes a
 * line saying what the screen is for, then the screen.
 *
 * It composes [`PageTitle`](./PageTitle.vue) rather than restating its style —
 * the heading is the precise component, this is the broad one, and the type
 * scale of a title stays defined in exactly one file.
 */
withDefaults(
  defineProps<{
    title: string
    /**
     * One line under the title, for a screen whose purpose is not obvious from
     * its name. Absent by default: a description repeating the title is noise
     * every reader has to skip.
     */
    description?: string
  }>(),
  { description: undefined },
)
</script>

<template>
  <Stack
    as="section"
    :gap="4"
  >
    <Stack :gap="1">
      <!-- The action sits beside the title, not above the content: it acts on
           the screen the title names. `wrap` so a long title and a button do
           not push a narrow page sideways. -->
      <Stack
        direction="row"
        :gap="3"
        align="center"
        justify="between"
        wrap
      >
        <PageTitle>{{ title }}</PageTitle>
        <slot name="action" />
      </Stack>
      <p
        v-if="description"
        class="description"
      >
        {{ description }}
      </p>
    </Stack>

    <slot />
  </Stack>
</template>

<style scoped>
.description {
  margin: 0;
  max-width: 60ch;
  color: var(--colour-text-muted);
}
</style>
