<template>
  <section class="control-section">
    <h3>Mouse HID</h3>
    <form class="form-grid" @submit.prevent="send('click', { x, y, button })">
      <label>
        X
        <input v-model.number="x" type="number" min="0" max="32767" />
      </label>
      <label>
        Y
        <input v-model.number="y" type="number" min="0" max="32767" />
      </label>
      <label>
        Button
        <select v-model="button">
          <option value="left">left</option>
          <option value="right">right</option>
          <option value="middle">middle</option>
        </select>
      </label>
      <ActionButton label="Click" :busy="busy === 'click'" />
    </form>

    <div class="button-row compact">
      <ActionButton label="Move ↑" @click="send('relMouseReport', { dx: 0, dy: -25 })" />
      <ActionButton label="Move ↓" @click="send('relMouseReport', { dx: 0, dy: 25 })" />
      <ActionButton label="Move ←" @click="send('relMouseReport', { dx: -25, dy: 0 })" />
      <ActionButton label="Move →" @click="send('relMouseReport', { dx: 25, dy: 0 })" />
      <ActionButton label="Wheel ↑" @click="send('wheelReport', { wheelY: 1 })" />
      <ActionButton label="Wheel ↓" @click="send('wheelReport', { wheelY: -1 })" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ActionPayload, PanelActionEvent } from '../types/kvm';
import type { MouseButton } from '../types/ui';
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

const x = ref(16384);
const y = ref(16384);
const button = ref<MouseButton>('left');

function send(action: string, payload: ActionPayload = {}): void {
  emit('action', { action, payload });
}
</script>
