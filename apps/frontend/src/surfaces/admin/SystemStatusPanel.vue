<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/shared/ui/Button.vue'
import { readHealth, type SystemStatus } from '@/shared/api/health'

const { t } = useI18n()

const status = ref<SystemStatus>({ kind: 'loading' })

async function refresh(): Promise<void> {
  status.value = { kind: 'loading' }
  status.value = await readHealth()
}

// Read once, when the dashboard opens. No polling: an administration page
// probing every few seconds costs the small server what this project is trying
// to save, and the operator can ask again.
onMounted(refresh)
</script>

<template>
  <section
    class="panel"
    :aria-busy="status.kind === 'loading'"
    :aria-label="t('admin.status.title')"
  >
    <h2 class="head">
      {{ t('admin.status.title') }}
    </h2>

    <template v-if="status.kind === 'loading'">
      <p class="visually-hidden">
        {{ t('admin.status.loading') }}
      </p>
      <div
        v-for="row in 2"
        :key="row"
        class="row"
      >
        <span class="skeleton name" />
        <span class="skeleton state" />
      </div>
    </template>

    <template v-else-if="status.kind === 'reachable'">
      <div class="row">
        <span
          class="dot ok"
          aria-hidden="true"
        />
        <span class="name">{{ t('admin.status.application') }}</span>
        <!-- The word carries the state; the dot only repeats it, so a reader
             who cannot tell the colours apart loses nothing. -->
        <span class="state ok">{{ t('admin.status.serving') }}</span>
      </div>
      <div class="row">
        <span
          class="dot"
          :class="status.health.database === 'up' ? 'ok' : 'bad'"
          aria-hidden="true"
        />
        <span class="name">{{ t('admin.status.database') }}</span>
        <span
          class="state"
          :class="status.health.database === 'up' ? 'ok' : 'bad'"
        >
          {{
            status.health.database === 'up'
              ? t('admin.status.reachable')
              : t('admin.status.unreachable')
          }}
        </span>
      </div>
      <p
        v-if="status.health.database !== 'up'"
        class="hint"
      >
        {{ t('admin.status.databaseDown') }}
      </p>
    </template>

    <template v-else>
      <div class="row">
        <span
          class="dot bad"
          aria-hidden="true"
        />
        <span class="name">{{ t('admin.status.application') }}</span>
        <span class="state bad">{{ t('admin.status.noAnswer') }}</span>
      </div>
      <!-- No database row: the API did not answer, so its state is unknown, and
           an unknown state is never drawn as a healthy one. -->
      <p class="hint">
        {{ t('admin.status.apiDown') }}
      </p>
      <p class="action">
        <Button @click="refresh">
          {{ t('admin.status.retry') }}
        </Button>
      </p>
    </template>
  </section>
</template>

<style scoped>
.panel {
  max-width: 26rem;
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-1);
  background: var(--colour-surface-raised);
}

.head {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--colour-border);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--colour-border);
}

.row:last-child {
  border-bottom: 0;
}

.dot {
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
}

.dot.ok {
  background: var(--colour-success);
}

.dot.bad {
  background: var(--colour-danger);
}

.name {
  flex: 1;
  font-size: var(--text-s);
}

.state {
  font-size: var(--text-s);
  font-weight: 600;
}

.state.ok {
  color: var(--colour-success);
}

.state.bad {
  color: var(--colour-danger);
}

.hint,
.action {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--colour-border);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}

.action {
  border-top: 0;
  padding-top: 0;
}

/* Loading keeps the row's shape so nothing jumps when the values land. */
.skeleton {
  height: 0.62rem;
  border-radius: 3px;
  background: var(--colour-border);
}

.skeleton.name {
  max-width: 5.5rem;
}

.skeleton.state {
  width: 3.2rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
