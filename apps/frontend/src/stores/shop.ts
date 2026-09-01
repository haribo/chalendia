import { defineStore } from 'pinia'
import { ref } from 'vue'

import { api } from '@/shared/api/client'

/**
 * What the interface knows about the shop it is serving.
 *
 * Read once before the first route resolves: until a shop is configured, setup
 * is the only thing the application shows, and that decision cannot be made
 * without asking.
 */
export const useShopStore = defineStore('shop', () => {
  const configured = ref(false)
  const name = ref<string | undefined>(undefined)
  /** Needed to display any price: one currency per shop, no switcher. */
  const currency = ref<string | undefined>(undefined)
  const loaded = ref(false)
  /** True when the shop could not be asked at all — the API is down. */
  const unreachable = ref(false)

  async function load(): Promise<void> {
    const { data, error } = await api.GET('/api/shop')

    if (data) {
      configured.value = data.configured
      name.value = data.name ?? undefined
      currency.value = data.currency ?? undefined
      unreachable.value = false
    } else {
      unreachable.value = Boolean(error) || true
    }

    loaded.value = true
  }

  function markConfigured(shopName?: string, shopCurrency?: string): void {
    configured.value = true
    name.value = shopName
    currency.value = shopCurrency
    loaded.value = true
  }

  return { configured, name, currency, loaded, unreachable, load, markConfigured }
})
