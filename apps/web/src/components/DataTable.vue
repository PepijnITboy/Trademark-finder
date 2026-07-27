<script setup lang="ts" generic="T extends object">
export interface DataTableColumn<T> {
  readonly key: string;
  readonly label: string;
  readonly align?: 'left' | 'right' | 'center';
  readonly width?: string;
}

withDefaults(
  defineProps<{
    columns: readonly DataTableColumn<T>[];
    rows: readonly T[];
    rowKey: (row: T) => string;
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    clickableRows?: boolean;
  }>(),
  {
    loading: false,
    emptyTitle: 'Geen gegevens',
    emptyDescription: 'Er is niets om te tonen.',
    clickableRows: false,
  },
);

defineEmits<{ (e: 'row-click', row: T): void }>();

const skeletonRows = [0, 1, 2, 3, 4];

function fallbackCellValue(row: T, key: string): string {
  const value = (row as Record<string, unknown>)[key];
  return value === null || value === undefined ? '—' : String(value);
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border bg-surface">
    <table class="w-full border-collapse text-left text-sm">
      <thead>
        <tr class="border-b border-border bg-surface-muted/60">
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-text-muted"
            :class="{ 'text-right': column.align === 'right', 'text-center': column.align === 'center' }"
            :style="column.width ? { width: column.width } : undefined"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="i in skeletonRows" :key="i" class="border-b border-border last:border-b-0">
            <td v-for="column in columns" :key="column.key" class="px-4 py-3">
              <div class="h-3.5 w-full max-w-[10rem] animate-pulse rounded bg-surface-muted" />
            </td>
          </tr>
        </template>
        <template v-else-if="rows.length === 0">
          <tr>
            <td :colspan="columns.length" class="px-4 py-10 text-center">
              <p class="text-sm font-medium text-text">{{ emptyTitle }}</p>
              <p class="mt-1 text-xs text-text-muted">{{ emptyDescription }}</p>
            </td>
          </tr>
        </template>
        <template v-else>
          <tr
            v-for="row in rows"
            :key="rowKey(row)"
            class="border-b border-border transition-colors last:border-b-0 hover:bg-surface-muted/50"
            :class="{ 'cursor-pointer': clickableRows }"
            tabindex="0"
            @click="$emit('row-click', row)"
            @keydown.enter="$emit('row-click', row)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 align-middle text-text"
              :class="{ 'text-right': column.align === 'right', 'text-center': column.align === 'center' }"
            >
              <slot :name="`cell-${column.key}`" :row="row">
                {{ fallbackCellValue(row, column.key) }}
              </slot>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
