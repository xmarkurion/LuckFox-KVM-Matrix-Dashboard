<template>
  <article class="device-card panel" :class="{ 'agent-only-card': !kvm.kvmEnabled }">
    <header class="device-card-header">
      <div class="device-identity">
        <div class="device-avatar" aria-hidden="true">{{ deviceInitial }}</div>
        <div>
          <p class="eyebrow">{{ kvm.kvmEnabled ? 'KVM + host agent' : 'Host agent' }}</p>
          <h2>{{ kvm.name }}</h2>
          <p class="device-id">{{ kvm.id }}</p>
        </div>
      </div>

      <div class="device-card-menu">
        <HostScriptMenu
          :scripts="kvm.hostScripts || []"
          :disabled="!kvm.hasHostScript"
          :busy="busy"
          @run="runHostScript"
        />
      </div>
    </header>

    <div class="device-health-row" aria-label="Device health">
      <StatusBadge v-if="kvm.kvmEnabled" :tone="kvmTone" :label="kvmStatusLabel" />
      <StatusBadge :tone="pcTone" :label="pcStatusLabel" />
      <span class="last-check">Checked {{ timeAgo(status?.checkedAt) }}</span>
    </div>

    <div class="address-grid" aria-label="Device addresses">
      <a v-if="kvm.kvmEnabled" class="address-card" :href="kvm.websiteUrl" target="_blank" rel="noreferrer">
        <span>KVM IP:</span>
        <strong>{{ kvm.ip }}</strong>
        <small>Open web console ↗</small>
      </a>
      <a v-if="kvm.pcUrl" class="address-card" :href="healthUrl" target="_blank" rel="noreferrer">
        <span>PC IP:</span>
        <strong>{{ kvm.pcIp || 'unknown' }}</strong>
        <small>Open agent health ↗</small>
      </a>
      <div v-else class="address-card unavailable">
        <span>PC IP:</span>
        <strong>Not configured</strong>
        <small>Add hostAgent.url in config</small>
      </div>
    </div>

    <p v-if="kvm.notes" class="device-notes">{{ kvm.notes }}</p>

    <div class="quick-actions" aria-label="Quick actions">
      <a v-if="kvm.kvmEnabled" class="btn primary" :href="kvm.websiteUrl" target="_blank" rel="noreferrer">Open KVM</a>
      <ActionButton v-if="kvm.kvmEnabled" label="Power" :busy="busy === 'power'" @click="emitAction('power')" />
      <ActionButton v-if="kvm.kvmEnabled" label="Wake screen" :busy="busy === 'arrowUp'" @click="emitAction('arrowUp')" />
      <a v-if="kvm.pcUrl" class="btn secondary" :href="healthUrl" target="_blank" rel="noreferrer">Agent health</a>
      <ActionButton label="Refresh" :busy="busy === 'refresh'" @click="$emit('refresh')" />
    </div>

    <div class="status-summary-grid">
      <div v-if="kvm.kvmEnabled" class="status-summary-item">
        <span>Video</span>
        <strong>{{ videoLabel(status?.video) }}</strong>
      </div>
      <div v-if="kvm.kvmEnabled" class="status-summary-item">
        <span>Power state</span>
        <strong>{{ status?.hostPower || 'unknown' }}</strong>
      </div>
      <div v-if="kvm.kvmEnabled" class="status-summary-item">
        <span>USB</span>
        <strong>{{ usbLabel(status?.usb) }}</strong>
      </div>
      <div class="status-summary-item">
        <span>Scripts</span>
        <strong>{{ scriptCountLabel }}</strong>
      </div>
      <div class="status-summary-item">
        <span>PC latency</span>
        <strong>{{ latencyLabel(status?.pcLatencyMs) }}</strong>
      </div>
      <div v-if="kvm.kvmEnabled" class="status-summary-item">
        <span>KVM latency</span>
        <strong>{{ latencyLabel(status?.latencyMs) }}</strong>
      </div>
    </div>

    <p v-if="kvm.kvmEnabled && status?.error" class="inline-error">KVM: {{ status.error }}</p>
    <p v-if="status?.pcError && !status?.pcResponds" class="inline-error">Host agent: {{ status.pcError }}</p>

    <HostStatsPanel :stats="status?.hostStats" :error="status?.hostStatsError" />

    <details class="details-block device-details">
      <summary>Connection details</summary>
      <div class="detail-list">
        <div v-if="kvm.kvmEnabled"><span>KVM status</span><strong>{{ kvmDetailStatus }}</strong></div>
        <div><span>PC status</span><strong>{{ status?.pcResponds ? 'online' : 'offline' }}</strong></div>
        <div v-if="kvm.pcUrl"><span>Agent check</span><strong>{{ timeAgo(status?.pcCheckedAt) }}</strong></div>
        <div><span>Scripts configured</span><strong>{{ scriptCountLabel }}</strong></div>
        <div v-if="status?.deviceId"><span>Device ID</span><strong>{{ status.deviceId }}</strong></div>
      </div>
    </details>

    <details v-if="kvm.kvmEnabled" class="details-block advanced-controls">
      <summary>Advanced KVM controls</summary>
      <section class="control-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Hardware control</p>
            <h3>Power and wake</h3>
          </div>
          <span class="tiny">Actions are sent through the LuckFox API.</span>
        </div>
        <div class="button-row">
          <ActionButton label="Reset" kind="danger" :busy="busy === 'reset'" @click="emitAction('reset')" />
          <ActionButton label="USB wakeup" :busy="busy === 'usbWakeup'" @click="emitAction('usbWakeup')" />
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

const deviceInitial = computed(() => props.kvm.name.trim().slice(0, 1).toUpperCase() || 'K');
const kvmTone = computed(() => statusTone(props.status));
const kvmStatusLabel = computed(() => {
  if (!props.status) return 'KVM pending';
  if (props.status.error) return 'KVM error';
  return props.status.kvmResponds ? 'KVM online' : props.status.authenticated ? 'KVM login only' : 'KVM offline';
});

const pcTone = computed<StatusTone>(() => {
  if (!props.kvm.pcUrl || !props.status) return 'unknown';
  return props.status.pcResponds ? 'good' : 'bad';
});

const pcStatusLabel = computed(() => {
  if (!props.kvm.pcUrl) return 'No PC agent';
  if (!props.status) return 'PC pending';
  return props.status.pcResponds ? 'PC online' : 'PC offline';
});

const scriptCountLabel = computed(() => {
  const count = props.kvm.hostScripts?.length || 0;
  if (!count) return 'None';
  return count === 1 ? '1 script' : `${count} scripts`;
});

const healthUrl = computed(() => {
  if (!props.kvm.pcUrl) return '';
  try {
    return new URL('/health', props.kvm.pcUrl.endsWith('/') ? props.kvm.pcUrl : `${props.kvm.pcUrl}/`).toString();
  } catch {
    return `${props.kvm.pcUrl.replace(/\/$/, '')}/health`;
  }
});

const kvmDetailStatus = computed(() => {
  if (!props.status) return 'pending';
  if (props.status.kvmResponds) return 'online';
  if (props.status.authenticated) return 'authenticated, API unavailable';
  return 'offline';
});

function latencyLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value} ms`;
}

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
