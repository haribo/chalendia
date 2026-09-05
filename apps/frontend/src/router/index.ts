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
export const SIGN_IN_PATH = '/sign-in'
/**
 * Where the design system is shown. Development only — see the route below.
 * Exported so the setup guard can let it through by name rather than by a
 * path spelled twice.
 */
export const DESIGN_SYSTEM_ROUTE = 'design-system'

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
    path: SIGN_IN_PATH,
    name: 'sign-in',
    component: () => import('@/surfaces/admin/SignInView.vue'),
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
      {
        path: 'catalogue',
        name: 'admin-catalogue',
        component: () => import('@/surfaces/admin/CatalogueView.vue'),
      },
      {
        path: 'catalogue/new',
        name: 'admin-catalogue-new',
        component: () => import('@/surfaces/admin/NewProductView.vue'),
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: () => import('@/surfaces/admin/SettingsView.vue'),
      },
    ],
  },
  /*
   * The design system, for whoever builds screens — never for a merchant.
   *
   * One gallery, not one per kind of component. tribnest split theirs between
   * primitives and assembled patterns, watched the two drift until neither
   * had a criterion for where a new element belonged, and merged them back
   * (their frontend ADR 0013). The composites this project has yet to build
   * land here, under their own heading.
   *
   * `import.meta.env.DEV` is a literal at build time, so the production bundle
   * carries neither this route nor the chunk behind it. A check on the built
   * assets asserts that rather than trusting the claim.
   */
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/design-system',
          name: DESIGN_SYSTEM_ROUTE,
          component: () => import('@/surfaces/dev/DesignSystemView.vue'),
        } satisfies RouteRecordRaw,
      ]
    : []),
]

/**
 * Until a shop exists, setup is the only thing the application shows: every
 * other route leads there, and no screen pretends to work without a shop.
 */
export function resolveSetupGuard(
  to: RouteLocationNormalized,
  configured: boolean,
): true | { name: string } {
  // The gallery shows components, not a shop. Sending it to setup would make
  // it unreachable on exactly the fresh checkout where it is most useful.
  if (configured || to.name === 'setup' || to.name === DESIGN_SYSTEM_ROUTE) {
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
): true | { name: string; query?: Record<string, string> } {
  // Already signed in, standing at the door: go in rather than fill a form.
  if (to.name === 'sign-in' && hasStaffRole) {
    return { name: 'admin-dashboard' }
  }

  const needsStaff = to.matched.some((record) => record.meta.requiresStaff)
  if (!needsStaff || hasStaffRole) {
    return true
  }

  // Carried so signing in lands on the page that was asked for, not on a
  // default dashboard.
  return { name: 'sign-in', query: { next: to.fullPath } }
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
