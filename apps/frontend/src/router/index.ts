import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
  type Router,
} from 'vue-router'

import { useSessionStore } from '@/stores/session'
import StorefrontLayout from '@/surfaces/storefront/StorefrontLayout.vue'

export const ADMIN_PREFIX = '/admin'

export const routes: RouteRecordRaw[] = [
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

  router.beforeEach((to) => resolveGuard(to, useSessionStore().hasStaffRole))

  return router
}
