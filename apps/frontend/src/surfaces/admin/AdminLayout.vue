<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AdminSections from '@/surfaces/admin/AdminSections.vue'
import AppBar from '@/shared/ui/AppBar.vue'
import Button from '@/shared/ui/Button.vue'
import AppShell from '@/shared/ui/AppShell.vue'
import Drawer from '@/shared/ui/Drawer.vue'
import IconMenu from '@/shared/ui/icons/IconMenu.vue'
import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
import NavLink from '@/shared/ui/NavLink.vue'
import ThemePicker from '@/shared/ui/ThemePicker.vue'
import { signOut } from '@/shared/api/session'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()

const menuOpen = ref(false)

async function leave(): Promise<void> {
  menuOpen.value = false
  await signOut()
  session.forget()
  // Back to the shop, not to the sign-in form: one leaves the back office, one
  // does not queue up to return to it.
  await router.push('/')
}

// The same threshold as the stylesheet below. Widening the window while the
// drawer is open would leave a modal panel over a layout that already shows
// its sections permanently.
const WIDE = '(min-width: 48rem)'

let wide: MediaQueryList | undefined

function onWidth(event: MediaQueryListEvent): void {
  if (event.matches) menuOpen.value = false
}

onMounted(() => {
  wide = window.matchMedia?.(WIDE)
  wide?.addEventListener('change', onWidth)
})

onBeforeUnmount(() => wide?.removeEventListener('change', onWidth))
</script>

<template>
  <AppShell>
    <template #bar>
      <AppBar :title="t('admin.title')">
        <template #actions>
          <LanguagePicker />
          <ThemePicker />
          <span
            v-if="session.staff"
            class="who wide-only"
          >{{ session.staff.email }}</span>
          <NavLink
            class="wide-only"
            to="/"
          >
            {{ t('admin.toShop') }}
          </NavLink>
          <Button
            class="wide-only"
            variant="link"
            @click="leave"
          >
            {{ t('admin.signOut') }}
          </Button>
          <!-- Below the threshold the five actions above no longer fit side by
               side, and the sections have nowhere to sit either. -->
          <Button
            class="narrow-only"
            variant="icon"
            :aria-label="t('admin.menu')"
            @click="menuOpen = true"
          >
            <IconMenu />
          </Button>
        </template>
      </AppBar>
    </template>

    <div class="workspace">
      <AdminSections
        class="rail"
        compact
      />

      <main class="canvas">
        <RouterView />
      </main>
    </div>

    <Drawer
      :open="menuOpen"
      :label="t('admin.title')"
      @close="menuOpen = false"
    >
      <AdminSections @pick="menuOpen = false" />

      <hr>

      <p
        v-if="session.staff"
        class="who"
      >
        {{ session.staff.email }}
      </p>
      <NavLink
        class="leave"
        to="/"
        @click="menuOpen = false"
      >
        {{ t('admin.toShop') }}
      </NavLink>
      <Button
        class="leave"
        variant="link"
        @click="leave"
      >
        {{ t('admin.signOut') }}
      </Button>
    </Drawer>
  </AppShell>
</template>

<style scoped>
.workspace {
  display: grid;
  flex: 1;
  grid-template-columns: 11rem 1fr;
}

.rail {
  padding: var(--space-3) var(--space-2);
  border-right: 1px solid var(--colour-border);
  background: var(--colour-surface-raised);
}

.canvas {
  min-width: 0;
  padding: var(--space-6) var(--space-4);
}

.who {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  color: var(--colour-text-muted);
  font-size: var(--text-s);
  text-overflow: ellipsis;
  white-space: nowrap;
}

hr {
  width: 100%;
  margin: var(--space-2) 0;
  border: 0;
  border-top: 1px solid var(--colour-border);
}

.leave {
  align-self: start;
  padding: var(--space-2) var(--space-3);
}

/* One threshold, stated once in the design: below it the back office adapts,
   above it the sections are permanent and no drawer exists. */
@media (max-width: 47.999rem) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .rail,
  .wide-only {
    display: none;
  }
}

@media (min-width: 48rem) {
  .narrow-only {
    display: none;
  }
}
</style>
