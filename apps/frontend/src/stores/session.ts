import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { readStaff, type StaffIdentity } from '@/shared/api/staff'

/**
 * What the interface knows about the current visitor.
 *
 * It authenticates nobody: the session is a cookie the browser cannot read, and
 * every restriction is enforced by the API. This state exists so the interface
 * does not offer a surface that would be refused — a convenience, never a
 * protection.
 */
export const useSessionStore = defineStore('session', () => {
  const staff = ref<StaffIdentity | null>(null)
  const loaded = ref(false)

  const hasStaffRole = computed(() => staff.value !== null)

  /** Asks the shop who is signed in. Called once, before the first route. */
  async function load(): Promise<void> {
    staff.value = await readStaff()
    loaded.value = true
  }

  /** After setup or sign-in: the response carried a session, so re-ask. */
  async function refresh(): Promise<void> {
    staff.value = await readStaff()
    loaded.value = true
  }

  function forget(): void {
    staff.value = null
    loaded.value = true
  }

  return { staff, loaded, hasStaffRole, load, refresh, forget }
})
