<script setup lang="ts">
import { ref, watch } from 'vue';
import ConfirmDialog from '../../../components/ConfirmDialog.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    placeholder?: string;
    required?: boolean;
    confirmLabel?: string;
    tone?: 'neutral' | 'danger';
    busy?: boolean;
  }>(),
  { description: undefined, placeholder: 'Toelichting (optioneel)…', required: false, confirmLabel: 'Bevestigen', tone: 'neutral', busy: false },
);

const emit = defineEmits<{ (e: 'confirm', reason: string): void; (e: 'cancel'): void }>();

const reason = ref('');
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reason.value = '';
  },
);
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
    <textarea
      v-model="reason"
      rows="4"
      maxlength="2000"
      :placeholder="placeholder"
      class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    />
  </ConfirmDialog>
</template>
