<template>
  <section class="control-section">
    <h3>Keyboard HID</h3>
    <div class="button-row compact">
      <ActionButton
        v-for="key in QUICK_KEYS"
        :key="key"
        :label="key"
        :busy="busy === 'keyPress'"
        @click="send('keyPress', { key })"
      />
      <ActionButton label="Ctrl+Alt+Del" kind="danger" :busy="busy === 'ctrlAltDel'" @click="send('ctrlAltDel')" />
    </div>

    <form class="form-grid" @submit.prevent="send('keyCombo', { combo })">
      <label>
        Combo
        <input v-model="combo" placeholder="Ctrl+Alt+Delete" />
      </label>
      <ActionButton label="Send combo" :busy="busy === 'keyCombo'" />
    </form>

    <form class="form-grid" @submit.prevent="send('typeText', { text, delayMs })">
      <label>
        Type text
        <textarea v-model="text" rows="3" placeholder="Text to type into host" />
      </label>
      <label>
        Delay ms
        <input v-model.number="delayMs" type="number" min="0" step="1" />
      </label>
      <ActionButton label="Type text" :busy="busy === 'typeText'" />
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { QUICK_KEYS } from '../config/capabilities';
import type { ActionPayload, PanelActionEvent } from '../types/kvm';
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

const combo = ref('Ctrl+Alt+Delete');
const text = ref('');
const delayMs = ref(5);

function send(action: string, payload: ActionPayload = {}): void {
  emit('action', { action, payload });
}
</script>
