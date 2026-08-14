import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
  type Router,
} from 'vue-router'

import { useSessionStore } from '@/stores/session'
import { useShopStore } from '@/stores/shop'
import StorefrontLayout from '@/surfaces/storefront/StorefrontLayout.vue'

export const ADMIN_PREFIX = '/admin'
export const SETUP_PATH = '/setup'

export const routes: RouteRecordRaw[] = [
  {
    path: SETUP_PATH,
    name: 'setup',
    component: () => import('@/surfaces/setup/SetupView.vue'),
  },
  {
    path: '/',
    component: StorefrontLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/surfaces/storefront/HomeView.vue'),
      },
    ],
  },
  {
    path: ADMIN_PREFIX,
    // Lazily loaded as one chunk: the back office is used by two people and
    // must never weigh on a shopper's first page.
    component: () => import('@/surfaces/admin/AdminLayout.vue'),
    meta: { requiresStaff: true },
    children: [
      {
        path: '',
        name: 'admin-dashboard',
        component: () => import('@/surfaces/admin/DashboardView.vue'),
      },
    ],
  },
]

/**
 * Until a shop exists, setup is the only thing the application shows: every
 * other route leads there, and no screen pretends to work without a shop.
 */
export function resolveSetupGuard(
  to: RouteLocationNormalized,
  configured: boolean,
): true | { name: string } {
  if (configured || to.name === 'setup') {
    return true
  }

  return { name: 'setup' }
}

/**
 * Sends a visitor without a staff role back to the shop. There is no
 * intermediate page: an unauthorised visitor is not told what exists.
 *
 * Exported separately from the router so it is tested without a browser.
 */
export function resolveGuard(
  to: RouteLocationNormalized,
  hasStaffRole: boolean,
): true | { name: string } {
  const needsStaff = to.matched.some((record) => record.meta.requiresStaff)
  return needsStaff && !hasStaffRole ? { name: 'home' } : true
}

export function createAppRouter(): Router {
  const router = createRouter({
    history: createWebHistory(),
    routes,
  })

  router.beforeEach(async (to) => {
    const shop = useShopStore()
    if (!shop.loaded) {
      await shop.load()
    }

    const setup = resolveSetupGuard(to, shop.configured)
    if (setup !== true) {
      return setup
    }

    // The session is a cookie the browser cannot read, so a reload knows
    // nothing until the shop is asked.
    const session = useSessionStore()
    if (!session.loaded) {
      await session.load()
    }

    return resolveGuard(to, session.hasStaffRole)
  })

  return router
}
