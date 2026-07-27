<script setup lang="ts">
const props = defineProps<{ modelValue: string | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string | null): void; (e: 'next'): void; (e: 'cancel'): void }>();

const registers = [
  { code: 'BOIP', name: 'BOIP', description: 'Benelux-Bureau voor de Intellectuele Eigendom.', available: true },
  { code: 'EUIPO', name: 'EUIPO', description: 'Bureau voor Intellectuele Eigendom van de Europese Unie.', available: false },
  { code: 'WIPO', name: 'WIPO', description: 'Internationaal register (Systeem van Madrid).', available: false },
  { code: 'USPTO', name: 'USPTO', description: 'Patent- en merkenbureau van de Verenigde Staten.', available: false },
];

function select(code: string, available: boolean): void {
  if (!available) return;
  emit('update:modelValue', code);
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-base font-semibold text-text">Kies het register</h2>
      <p class="mt-1 text-sm text-text-muted">Selecteer waar het te bewaken merk officieel is geregistreerd.</p>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        v-for="register in registers"
        :key="register.code"
        type="button"
        class="flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        :class="[
          !register.available && 'cursor-not-allowed opacity-60',
          props.modelValue === register.code ? 'border-accent-strong bg-accent-soft' : 'border-border bg-surface hover:bg-surface-muted/50',
        ]"
        :disabled="!register.available"
        @click="select(register.code, register.available)"
      >
        <span class="flex w-full items-center justify-between">
          <span class="text-sm font-semibold text-text">{{ register.name }}</span>
          <span
            v-if="!register.available"
            class="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted"
            >Binnenkort</span
          >
        </span>
        <span class="text-xs text-text-muted">{{ register.description }}</span>
      </button>
    </div>
    <div class="flex justify-end gap-2 border-t border-border pt-4">
      <button
        type="button"
        class="rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!props.modelValue"
        @click="emit('next')"
      >
        Volgende
      </button>
    </div>
  </div>
</template>
