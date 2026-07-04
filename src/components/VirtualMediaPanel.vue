<template>
  <section class="control-section">
    <h3>Virtual media</h3>
    <form class="form-grid" @submit.prevent="send('mountWithHTTP', { url, mode })">
      <label>
        HTTP image URL
        <input v-model="url" placeholder="http://server/image.iso" />
      </label>
      <label>
        Mode
        <select v-model="mode">
          <option value="CDROM">CDROM</option>
          <option value="Disk">Disk</option>
        </select>
      </label>
      <ActionButton label="Mount HTTP" :busy="busy === 'mountWithHTTP'" />
    </form>

    <form class="form-grid" @submit.prevent="send('mountWithStorage', { filename, mode })">
      <label>
        Stored filename
        <input v-model="filename" placeholder="installer.iso" />
      </label>
      <ActionButton label="Mount stored" :busy="busy === 'mountWithStorage'" />
    </form>

    <div class="button-row compact">
      <ActionButton label="Mount built-in" @click="send('mountBuiltInImage', { filename: builtInFilename })" />
      <input v-model="builtInFilename" class="inline-input" placeholder="built-in filename" />
      <ActionButton label="Unmount" kind="danger" :busy="busy === 'unmountImage'" @click="send('unmountImage')" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ActionPayload, PanelActionEvent } from '../types/kvm';
import type { MountMode } from '../types/ui';
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

const url = ref('');
const filename = ref('');
const builtInFilename = ref('');
const mode = ref<MountMode>('CDROM');

function send(action: string, payload: ActionPayload = {}): void {
  emit('action', { action, payload });
}
</script>
