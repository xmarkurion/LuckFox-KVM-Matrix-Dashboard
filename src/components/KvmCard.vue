<template>
  <article class="kvm-card panel glow" :class="{ 'agent-only-card': !kvm.kvmEnabled }">
    <header class="card-header">
      <div>
        <p class="eyebrow">{{ kvm.id }}</p>
        <h2>{{ kvm.name }}</h2>
      </div>
      <div class="card-header-right">
        <HostScriptMenu
          :scripts="kvm.hostScripts || []"
          :disabled="!kvm.hasHostScript"
          :busy="busy"
          @run="runHostScript"
        />
        <div class="online-badges" aria-label="Online status">
          <StatusBadge v-if="kvm.kvmEnabled" :tone="kvmTone" :label="kvmStatusLabel" />
          <StatusBadge :tone="pcTone" :label="pcStatusLabel" />
        </div>
      </div>
    </header>

    <div class="ip-panel" aria-label="KVM and PC addresses">
      <div v-if="kvm.kvmEnabled">
        <span>KVM IP:</span>
        <a :href="kvm.websiteUrl" target="_blank" rel="noreferrer">{{ kvm.ip }}</a>
      </div>
      <div>
        <span>PC IP:</span>
        <a v-if="kvm.pcUrl" :href="kvm.pcUrl" target="_blank" rel="noreferrer">{{ kvm.pcIp || kvm.pcUrl }}</a>
        <strong v-else>not configured</strong>
      </div>
    </div>

    <p class="notes">{{ kvm.notes || 'No notes yet.' }}</p>

    <div class="status-lines">
      <div v-if="kvm.kvmEnabled"><span>KVM online:</span><strong>{{ status?.kvmResponds ? 'online' : status?.authenticated ? 'login only' : 'offline' }}</strong></div>
      <div><span>PC online:</span><strong>{{ status?.pcResponds ? 'online' : 'offline' }}</strong></div>
      <div v-if="kvm.pcUrl"><span>PC ping:</span><strong>{{ status?.pcLatencyMs ?? '—' }} ms · {{ timeAgo(status?.pcCheckedAt) }}</strong></div>
      <div v-if="kvm.kvmEnabled"><span>Power LED:</span><strong>{{ status?.hostPower || 'unknown' }}</strong></div>
      <div v-if="kvm.kvmEnabled"><span>Video:</span><strong>{{ videoLabel(status?.video) }}</strong></div>
      <div v-if="kvm.kvmEnabled"><span>USB:</span><strong>{{ usbLabel(status?.usb) }}</strong></div>
      <div><span>Host scripts:</span><strong>{{ scriptCountLabel }}</strong></div>
      <div v-if="kvm.kvmEnabled"><span>KVM latency:</span><strong>{{ status?.latencyMs ?? '—' }} ms</strong></div>
      <div><span>Checked:</span><strong>{{ timeAgo(status?.checkedAt) }}</strong></div>
    </div>

    <p v-if="kvm.kvmEnabled && status?.error" class="inline-error">{{ status.error }}</p>
    <p v-if="status?.pcError && !status?.pcResponds" class="inline-error">PC host-agent: {{ status.pcError }}</p>

    <HostStatsPanel :stats="status?.hostStats" :error="status?.hostStatsError" />

    <div class="button-row">
      <a v-if="kvm.kvmEnabled" class="btn secondary" :href="kvm.websiteUrl" target="_blank" rel="noreferrer">Open KVM</a>
      <a v-if="kvm.pcUrl" class="btn secondary" :href="kvm.pcUrl" target="_blank" rel="noreferrer">Open PC Agent</a>
      <ActionButton label="Refresh" :busy="busy === 'refresh'" @click="$emit('refresh')" />
      <ActionButton v-if="kvm.kvmEnabled" label="Power" kind="primary" :busy="busy === 'power'" @click="emitAction('power')" />
      <ActionButton v-if="kvm.kvmEnabled" label="Arrow Up" kind="primary" :busy="busy === 'arrowUp'" @click="emitAction('arrowUp')" />
    </div>

    <details v-if="kvm.kvmEnabled" class="details-block">
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
import HostScriptMenu from './HostScriptMenu.vue';
import HostStatsPanel from './HostStatsPanel.vue';
import KeyboardPanel from './KeyboardPanel.vue';
import MousePanel from './MousePanel.vue';
import RawRpcPanel from './RawRpcPanel.vue';
import StatusBadge from './StatusBadge.vue';
import VirtualMediaPanel from './VirtualMediaPanel.vue';
import { statusTone, timeAgo, usbLabel, videoLabel } from '../services/formatters';
import type { ActionPayload, HostScriptSummary, KvmActionEvent, KvmStatus, KvmSummary, PanelActionEvent } from '../types/kvm';
import type { StatusTone } from '../types/ui';

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

const kvmTone = computed(() => statusTone(props.status));
const kvmStatusLabel = computed(() => {
  if (!props.kvm.kvmEnabled) return 'KVM disabled';
  if (!props.status) return 'KVM pending';
  if (props.status.error) return 'KVM error';
  return props.status.kvmResponds ? 'KVM online' : props.status.authenticated ? 'KVM login only' : 'KVM offline';
});

const pcTone = computed<StatusTone>(() => {
  if (!props.kvm.pcUrl) return 'unknown';
  if (!props.status) return 'unknown';
  return props.status.pcResponds ? 'good' : 'bad';
});

const pcStatusLabel = computed(() => {
  if (!props.kvm.pcUrl) return 'PC no agent';
  if (!props.status) return 'PC pending';
  return props.status.pcResponds ? 'PC online' : 'PC offline';
});

const scriptCountLabel = computed(() => {
  const count = props.kvm.hostScripts?.length || 0;
  if (!count) return 'not configured';
  return count === 1 ? '1 script' : `${count} scripts`;
});

function emitAction(action: string, payload: ActionPayload = {}): void {
  emit('action', { id: props.kvm.id, action, payload });
}

function runHostScript(script: HostScriptSummary): void {
  emitAction('hostScript', {
    scriptId: script.id,
    scriptLabel: script.label
  });
}

function forwardAction(event: PanelActionEvent): void {
  emitAction(event.action, event.payload);
}
</script>
