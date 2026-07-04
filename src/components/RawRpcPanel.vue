<template>
  <section class="control-section">
    <h3>Raw JSON-RPC</h3>
    <p class="tiny">
      Use this for firmware methods not surfaced as buttons. Params must be a JSON object.
    </p>
    <form class="form-grid" @submit.prevent="submit">
      <label>
        Method
        <input v-model="method" placeholder="getVideoState" />
      </label>
      <label>
        Params JSON
        <textarea v-model="paramsText" rows="4" placeholder='{"force": false}' />
      </label>
      <ActionButton label="Run RPC" :busy="busy === 'rawRpc'" />
    </form>
    <p v-if="parseError" class="inline-error">{{ parseError }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ActionPayload, JsonValue, PanelActionEvent } from '../types/kvm';
import ActionButton from './ActionButton.vue';

withDefaults(
  defineProps<{
    busy?: string;
  }>(),
  {
    busy: ''
  }
);

const emit = defineEmits<{
  action: [event: PanelActionEvent];
}>();

const method = ref('getVideoState');
const paramsText = ref('{}');
const parseError = ref('');

function isActionPayload(value: JsonValue | unknown): value is ActionPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function submit(): void {
  parseError.value = '';
  let params: ActionPayload = {};
  try {
    const parsed = paramsText.value.trim() ? JSON.parse(paramsText.value) : {};
    if (!isActionPayload(parsed)) {
      parseError.value = 'Params must be a JSON object.';
      return;
    }
    params = parsed;
  } catch (err) {
    parseError.value = err instanceof Error ? err.message : String(err);
    return;
  }
  emit('action', { action: 'rawRpc', payload: { method: method.value, params } });
}
</script>
