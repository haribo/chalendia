<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AdminSections from '@/surfaces/admin/AdminSections.vue'
import AppBar from '@/shared/ui/AppBar.vue'
import Button from '@/shared/ui/Button.vue'
import AppShell from '@/shared/ui/AppShell.vue'
import Drawer from '@/shared/ui/Drawer.vue'
import IconChevronLeft from '@/shared/ui/icons/IconChevronLeft.vue'
import IconChevronRight from '@/shared/ui/icons/IconChevronRight.vue'
import IconLogout from '@/shared/ui/icons/IconLogout.vue'
import IconMenu from '@/shared/ui/icons/IconMenu.vue'
import IconStorefront from '@/shared/ui/icons/IconStorefront.vue'
import NavLink from '@/shared/ui/NavLink.vue'
import { useFoldedRail } from '@/composables/useFoldedRail'
import { signOut } from '@/shared/api/session'
import { PRODUCT_NAME } from '@/shared/shop'
import { useSessionStore } from '@/stores/session'
import { useShopStore } from '@/stores/shop'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const shop = useShopStore()

// The shop's own name: one administers a shop, and its name is the one thing
// worth reading permanently in the bar (docs/design/core.md § 4).
const title = computed(() => shop.name ?? PRODUCT_NAME)

const menuOpen = ref(false)
const { folded, toggle } = useFoldedRail()

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
      <AppBar :title="title">
        <template #leading>
          <!-- Below the threshold the sections have nowhere to sit, so the bar
               carries the one control that opens them — on the left, where the
               drawer comes from. -->
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

    <div
      class="workspace"
      :class="{ folded }"
    >
      <div
        class="rail"
        :class="{ folded }"
      >
        <AdminSections
          compact
          :folded="folded"
          :current-path="route.path"
        />

        <span class="spacer" />

        <div class="account">
          <NavLink
            to="/"
            :title="folded ? t('admin.toShop') : undefined"
          >
            <IconStorefront />
            <span :class="{ 'visually-hidden': folded }">{{ t('admin.toShop') }}</span>
          </NavLink>
          <Button
            variant="link"
            :title="folded ? t('admin.signOut') : undefined"
            @click="leave"
          >
            <IconLogout />
            <span :class="{ 'visually-hidden': folded }">{{ t('admin.signOut') }}</span>
          </Button>
        </div>

        <!-- Last, under its own rule: it acts on the rail, not on anything the
             rail holds. The chevron points the way pressing it goes. -->
        <Button
          class="fold"
          variant="link"
          :aria-label="folded ? t('admin.unfold') : t('admin.fold')"
          @click="toggle"
        >
          <IconChevronRight v-if="folded" />
          <IconChevronLeft v-else />
          <span v-if="!folded">{{ t('admin.fold') }}</span>
        </Button>
      </div>

      <main class="canvas">
        <RouterView />
      </main>
    </div>

    <Drawer
      :open="menuOpen"
      :label="title"
      @close="menuOpen = false"
    >
      <AdminSections
        :current-path="route.path"
        @pick="menuOpen = false"
      />

      <hr>

      <NavLink
        class="leave"
        to="/"
        @click="menuOpen = false"
      >
        <IconStorefront />
        {{ t('admin.toShop') }}
      </NavLink>
      <Button
        class="leave"
        variant="link"
        @click="leave"
      >
        <IconLogout />
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

/* The column is what holds the width, so folding the rail means folding the
   column it sits in. */
.workspace.folded {
  grid-template-columns: 3.5rem 1fr;
}

.rail {
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-2);
  border-right: 1px solid var(--colour-border);
  background: var(--colour-surface-raised);
}

.rail.folded {
  align-items: center;
  padding: var(--space-3) var(--space-1);
}

.spacer {
  flex: 1;
}

/* Who is signed in, and how to leave: at the foot of the navigation, which is
   where the drawer already puts them on a phone. */
.account {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: start;
  padding-top: var(--space-2);
  border-top: 1px solid var(--colour-border);
}

.account > * {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-s);
}

.folded .account {
  align-items: center;
  width: 100%;
}

.folded .account > * {
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
}

/* Its own rule above it, so the rail reads as three groups: the sections, the
   account, and the control that folds them. */
.fold {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  align-self: stretch;
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-2) 0;
  border-top: 1px solid var(--colour-border);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
  font-weight: 400;
}

.folded .fold {
  justify-content: center;
  padding: var(--space-2) 0 0;
}

.canvas {
  min-width: 0;
  padding: var(--space-6) var(--space-4);
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

  .rail {
    display: none;
  }
}

@media (min-width: 48rem) {
  .narrow-only {
    display: none;
  }
}
</style>
