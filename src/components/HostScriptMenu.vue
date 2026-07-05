<template>
  <details class="script-menu" :class="{ disabled }">
    <summary class="btn script-menu-trigger" :aria-disabled="disabled" @click="disabled && $event.preventDefault()">
      <span aria-hidden="true">☰</span>
      <span>Scripts</span>
      <span v-if="busyAny" class="spinner" />
    </summary>

    <div class="script-menu-panel" role="menu">
      <p v-if="!scripts.length" class="tiny script-menu-empty">No host scripts configured.</p>
      <button
        v-for="script in scripts"
        :key="script.id"
        class="script-menu-item"
        type="button"
        role="menuitem"
        :disabled="disabled || isBusy(script.id)"
        @click="run(script)"
      >
        <span class="script-menu-label">{{ script.label }}</span>
        <small v-if="script.description">{{ script.description }}</small>
        <small v-else>ID: {{ script.id }}</small>
      </button>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HostScriptSummary } from '../types/kvm';

const props = withDefaults(
  defineProps<{
    scripts: HostScriptSummary[];
    busy?: string;
    disabled?: boolean;
  }>(),
  {
    busy: '',
    disabled: false
  }
);

const emit = defineEmits<{
  run: [script: HostScriptSummary];
}>();

function isBusy(scriptId: string): boolean {
  return props.busy === 'hostScript' || props.busy === `hostScript:${scriptId}`;
}

const busyAny = computed(() => props.busy === 'hostScript' || props.busy.startsWith('hostScript:'));

function run(script: HostScriptSummary): void {
  if (props.disabled) return;
  emit('run', script);
}
</script>
