<template>
  <section class="dashboard-toolbar panel" aria-label="Device filters">
    <label class="search-box">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        :value="search"
        type="search"
        placeholder="Search by name, IP or note"
        aria-label="Search devices"
        @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <div class="filter-group" role="group" aria-label="Filter devices">
      <button
        v-for="option in options"
        :key="option.value"
        class="filter-chip"
        :class="{ active: filter === option.value }"
        type="button"
        @click="$emit('update:filter', option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <span class="result-count">{{ resultCount }} shown</span>
  </section>
</template>

<script setup lang="ts">
import type { DeviceFilter } from '../types/ui';

defineProps<{
  search: string;
  filter: DeviceFilter;
  resultCount: number;
}>();

defineEmits<{
  'update:search': [value: string];
  'update:filter': [value: DeviceFilter];
}>();

const options: Array<{ value: DeviceFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Needs attention' },
  { value: 'agent-only', label: 'Agent only' }
];
</script>
