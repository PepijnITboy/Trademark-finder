<script setup lang="ts">
import { ref, watch } from 'vue';
import ConfirmDialog from '../../../components/ConfirmDialog.vue';
import MwButton from '../../../components/MwButton.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    placeholder?: string;
    /** Prefills the reason field when the dialog opens. */
    preset?: string;
    required?: boolean;
    confirmLabel?: string;
    tone?: 'neutral' | 'danger';
    busy?: boolean;
  }>(),
  {
    description: undefined,
    placeholder: 'Toelichting (optioneel)…',
    preset: undefined,
    required: false,
    confirmLabel: 'Bevestigen',
    tone: 'neutral',
    busy: false,
  },
);

const emit = defineEmits<{ (e: 'confirm', reason: string): void; (e: 'cancel'): void }>();

const reason = ref('');
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reason.value = props.preset ?? '';
  },
);

function applyPreset(value: string): void {
  reason.value = value;
}
</script>

<template>
  <ConfirmDialog
    :open="open"
    :title="title"
    :description="description"
    :confirm-label="confirmLabel"
    :tone="tone"
    :busy="busy"
    :confirm-disabled="required && reason.trim().length === 0"
    @confirm="emit('confirm', reason.trim())"
    @cancel="emit('cancel')"
  >
    <div class="mb-3 flex flex-wrap gap-2">
      <MwButton type="button" size="sm" variant="secondary" @click="applyPreset('Niet relevant')">
        Niet relevant
      </MwButton>
      <MwButton type="button" size="sm" variant="tertiary" @click="applyPreset('Andere waren/diensten')">
        Andere waren/diensten
      </MwButton>
    </div>
    <textarea
      v-model="reason"
      rows="4"
      maxlength="2000"
      :placeholder="placeholder"
      class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    />
  </ConfirmDialog>
</template>
