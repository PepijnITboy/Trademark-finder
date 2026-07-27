<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

export interface MwSelectOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: readonly MwSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    id?: string;
  }>(),
  { placeholder: 'Selecteer…', disabled: false, id: undefined },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);
const openUp = ref(false);
const highlighted = ref(0);
const root = ref<HTMLElement | null>(null);
const listboxId = computed(() => (props.id ? `${props.id}-listbox` : undefined));

const selectedLabel = computed(() => {
  const match = props.options.find((opt) => opt.value === props.modelValue);
  return match?.label ?? props.placeholder;
});

const hasSelection = computed(() => props.options.some((opt) => opt.value === props.modelValue));

function close(): void {
  open.value = false;
}

function select(value: string): void {
  emit('update:modelValue', value);
  close();
}

function measurePlacement(): void {
  const el = root.value;
  if (!el) {
    openUp.value = false;
    return;
  }
  const rect = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  openUp.value = spaceBelow < 240 && rect.top > spaceBelow;
}

function toggle(): void {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    measurePlacement();
    const idx = props.options.findIndex((opt) => opt.value === props.modelValue);
    highlighted.value = idx >= 0 ? idx : 0;
  }
}

function moveHighlight(delta: number): void {
  if (props.options.length === 0) return;
  highlighted.value = (highlighted.value + delta + props.options.length) % props.options.length;
}

function onKeydown(event: KeyboardEvent): void {
  if (props.disabled) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (!open.value) {
        open.value = true;
        highlighted.value = 0;
      } else {
        moveHighlight(1);
      }
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (!open.value) {
        open.value = true;
        highlighted.value = props.options.length - 1;
      } else {
        moveHighlight(-1);
      }
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (!open.value) {
        open.value = true;
        highlighted.value = Math.max(
          0,
          props.options.findIndex((opt) => opt.value === props.modelValue),
        );
      } else {
        const option = props.options[highlighted.value];
        if (option) select(option.value);
      }
      break;
    case 'Escape':
      event.preventDefault();
      close();
      break;
    case 'Tab':
      close();
      break;
    default:
      break;
  }
}

function onClickOutside(event: MouseEvent): void {
  if (!root.value?.contains(event.target as Node)) close();
}

watch(
  () => props.options,
  () => {
    if (highlighted.value >= props.options.length) highlighted.value = 0;
  },
);

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
});

watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  const el = root.value?.querySelector<HTMLElement>(`[data-index="${highlighted.value}"]`);
  el?.scrollIntoView({ block: 'nearest' });
});
</script>

<template>
  <div ref="root" class="relative">
    <button
      :id="id"
      type="button"
      role="combobox"
      class="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3.5 py-2.5 text-left text-sm text-text shadow-sm transition-colors hover:border-text-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      :class="[!hasSelection && 'text-text-muted', open && 'border-accent-strong ring-2 ring-accent/20']"
      :aria-expanded="open"
      :aria-controls="listboxId"
      :aria-haspopup="'listbox'"
      :disabled="disabled"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="min-w-0 truncate">{{ selectedLabel }}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-4 w-4 shrink-0 text-text-muted transition-transform duration-150"
        :class="open && 'rotate-180'"
        aria-hidden="true"
      >
        <path d="M4 6 8 10 12 6" />
      </svg>
    </button>

    <ul
      v-if="open"
      :id="listboxId"
      role="listbox"
      class="absolute z-30 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface py-1.5 shadow-lg"
      :class="openUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'"
    >
      <li
        v-for="(option, index) in options"
        :key="option.value"
        role="option"
        :data-index="index"
        :aria-selected="option.value === modelValue"
        class="mx-1 cursor-pointer rounded-md px-3 py-2 text-sm transition-colors"
        :class="
          index === highlighted
            ? 'bg-accent-soft font-medium text-text'
            : option.value === modelValue
              ? 'font-medium text-text'
              : 'text-text-muted hover:bg-surface-hover hover:text-text'
        "
        @mouseenter="highlighted = index"
        @mousedown.prevent="select(option.value)"
      >
        {{ option.label }}
      </li>
    </ul>
  </div>
</template>
