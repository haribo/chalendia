import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * What the interface knows about the current visitor.
 *
 * Nothing here authenticates anyone: authentication arrives with the account
 * slice, and every restriction is enforced by the API regardless. The route
 * guard reads this state only to avoid offering a surface that would be
 * refused — a convenience, never a protection.
 */
export const useSessionStore = defineStore('session', () => {
  const hasStaffRole = ref(false)

  function grantStaffRole(): void {
    hasStaffRole.value = true
  }

  function revokeStaffRole(): void {
    hasStaffRole.value = false
  }

  return { hasStaffRole, grantStaffRole, revokeStaffRole }
})
