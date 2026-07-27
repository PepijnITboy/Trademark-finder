<script setup lang="ts">
import StatusBadge from '../../../components/StatusBadge.vue';
import { formatDateTime } from '../../../lib/format';
import type { WatchEligibilityDecision } from '@merkwacht/domain';

defineProps<{ eligibility: WatchEligibilityDecision }>();
const emit = defineEmits<{ (e: 'next'): void; (e: 'back'): void }>();
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-base font-semibold text-text">Geschiktheid voor bewaking</h2>
      <p class="mt-1 text-sm text-text-muted">
        Merkwacht beoordeelt automatisch of dit merk in aanmerking komt voor bewaking.
      </p>
    </div>

    <div class="rounded-lg border border-border bg-surface p-5">
      <div class="flex items-center gap-3">
        <StatusBadge :label="eligibility.eligible ? 'Geschikt voor bewaking' : 'Niet geschikt voor bewaking'" :tone="eligibility.eligible ? 'success' : 'warning'" />
      </div>
      <p class="mt-3 text-sm text-text">{{ eligibility.reasonLabelNl }}</p>
      <dl class="mt-4 grid grid-cols-2 gap-4 text-xs text-text-muted">
        <div>
          <dt class="uppercase tracking-wide">Beoordeeld op</dt>
          <dd class="mt-0.5 text-text">{{ formatDateTime(eligibility.evaluatedAt) }}</dd>
        </div>
        <div>
          <dt class="uppercase tracking-wide">Beleidsversie</dt>
          <dd class="mt-0.5 text-text">{{ eligibility.policyVersion }}</dd>
        </div>
      </dl>
      <ul v-if="eligibility.warnings.length > 0" class="mt-4 space-y-1.5 border-t border-border pt-4">
        <li v-for="warning in eligibility.warnings" :key="warning" class="text-xs text-warning">{{ warning }}</li>
      </ul>
      <p v-if="!eligibility.eligible" class="mt-4 rounded-md bg-surface-muted px-3 py-2 text-xs text-text-muted">
        U kunt dit merk toch toevoegen ter administratie. Zodra de registratiestatus wijzigt, kan bewaking
        automatisch actief worden.
      </p>
    </div>

    <div class="flex justify-end gap-2 border-t border-border pt-4">
      <button type="button" class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted" @click="emit('back')">
        Terug
      </button>
      <button type="button" class="rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white hover:bg-accent" @click="emit('next')">
        Volgende
      </button>
    </div>
  </div>
</template>
