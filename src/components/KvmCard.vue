<template>
  <article class="kvm-card panel glow">
    <header class="card-header">
      <div>
        <p class="eyebrow">{{ kvm.ip }}</p>
        <h2>{{ kvm.name }}</h2>
      </div>
      <StatusBadge :tone="tone" :label="statusLabel" />
    </header>

    <p class="notes">{{ kvm.notes || 'No notes yet.' }}</p>

    <div class="status-lines">
      <div><span>KVM:</span><strong>{{ status?.kvmResponds ? 'responding' : 'not confirmed' }}</strong></div>
      <div><span>Power LED:</span><strong>{{ status?.hostPower || 'unknown' }}</strong></div>
      <div><span>Video:</span><strong>{{ videoLabel(status?.video) }}</strong></div>
      <div><span>USB:</span><strong>{{ usbLabel(status?.usb) }}</strong></div>
      <div><span>Latency:</span><strong>{{ status?.latencyMs ?? '—' }} ms</strong></div>
      <div><span>Checked:</span><strong>{{ timeAgo(status?.checkedAt) }}</strong></div>
    </div>

    <p v-if="status?.error" class="inline-error">{{ status.error }}</p>

    <div class="button-row">
      <a class="btn secondary" :href="kvm.websiteUrl" target="_blank" rel="noreferrer">Open KVM</a>
      <ActionButton label="Refresh" :busy="busy === 'refresh'" @click="$emit('refresh')" />
      <ActionButton label="Power" kind="primary" :busy="busy === 'power'" @click="emitAction('power')" />
      <ActionButton label="Arrow Up" kind="primary" :busy="busy === 'arrowUp'" @click="emitAction('arrowUp')" />
    </div>

    <details class="details-block">
      <summary>More API controls</summary>
      <section class="control-section">
        <h3>Host power</h3>
        <div class="button-row">
          <ActionButton label="Reset" kind="danger" :busy="busy === 'reset'" @click="emitAction('reset')" />
          <ActionButton label="USB Wakeup" :busy="busy === 'usbWakeup'" @click="emitAction('usbWakeup')" />
          <ActionButton label="Wake-on-LAN" :disabled="!kvm.hasWolMac" :busy="busy === 'wol'" @click="emitAction('wol')" />
        </div>
      </section>

      <KeyboardPanel :busy="busy" @action="forwardAction" />
      <MousePanel :busy="busy" @action="forwardAction" />
      <VirtualMediaPanel :busy="busy" @action="forwardAction" />
      <RawRpcPanel :busy="busy" @action="forwardAction" />
    </details>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ActionButton from './ActionButton.vue';
import KeyboardPanel from './KeyboardPanel.vue';
import MousePanel from './MousePanel.vue';
import RawRpcPanel from './RawRpcPanel.vue';
import StatusBadge from './StatusBadge.vue';
import VirtualMediaPanel from './VirtualMediaPanel.vue';
import { statusTone, timeAgo, usbLabel, videoLabel } from '../services/formatters';
import type { ActionPayload, KvmActionEvent, KvmStatus, KvmSummary, PanelActionEvent } from '../types/kvm';

const props = withDefaults(
  defineProps<{
    kvm: KvmSummary;
    status?: KvmStatus | null;
    busy?: string;
  }>(),
  {
    status: null,
    busy: ''
  }
);

const emit = defineEmits<{
  refresh: [];
  action: [event: KvmActionEvent];
}>();

const tone = computed(() => statusTone(props.status));
const statusLabel = computed(() => {
  if (!props.status) return 'pending';
  if (props.status.error) return 'error';
  return props.status.kvmResponds ? 'online' : 'login only';
});

function emitAction(action: string, payload: ActionPayload = {}): void {
  emit('action', { id: props.kvm.id, action, payload });
}

function forwardAction(event: PanelActionEvent): void {
  emitAction(event.action, event.payload);
}
</script>
