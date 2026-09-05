<script setup lang="ts">
import Stack from '@/shared/ui/Stack.vue'
import { anchorOf, FAMILIES } from '@/surfaces/dev/gallery-registry'

/**
 * The side menu, derived from the registry the page itself is built from.
 *
 * Derived rather than written: a menu listing sections by hand is a menu that
 * points at a section somebody renamed. Here the two cannot disagree — adding a
 * component to a family adds its section and its entry in one edit.
 *
 * Anchors rather than a router: every section is on this page, and a link that
 * scrolls is what the reader expects from a table of contents.
 */
</script>

<template>
  <Stack
    as="nav"
    :gap="4"
    class="menu"
    aria-label="Composants"
  >
    <Stack
      v-for="family in FAMILIES"
      :key="family.label"
      :gap="1"
    >
      <p class="family">
        {{ family.label }}
      </p>
      <Stack
        as="ul"
        :gap="1"
      >
        <li
          v-for="component in family.components"
          :key="component"
        >
          <!-- A plain anchor: `NavLink` navigates between routes, and this
               moves within one page. The day a second surface needs an
               in-page link, the two occurrences become a shared component
               (frontend ADR 0003 § 3). -->
          <a :href="`#${anchorOf(component)}`">{{ component }}</a>
        </li>
      </Stack>
    </Stack>
  </Stack>
</template>

<style scoped>
.menu {
  position: sticky;
  top: var(--space-8);
  width: 11rem;
  flex: none;
  align-self: start;
}

/* Below the back office's own threshold the menu would take a third of the
   width to list what the page already shows in order. It goes, and the page
   is read by scrolling — which is what a phone does anyway. */
@media (max-width: 767px) {
  .menu {
    display: none;
  }
}

.family {
  margin: 0;
  font-size: var(--text-s);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--colour-text-muted);
}

a {
  color: var(--colour-accent);
  font-family: var(--font-mono);
  font-size: var(--text-s);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
