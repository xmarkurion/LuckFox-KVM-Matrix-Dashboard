<template>
  <Teleport to="body">
    <div v-if="open" class="settings-overlay" role="presentation" @mousedown.self="requestClose">
      <section class="settings-dialog panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="settings-header">
          <div>
            <p class="eyebrow">Dashboard administration</p>
            <h2 id="settings-title">Settings</h2>
            <p>Edit devices, KVM endpoints, host agents, scripts and server timing from one place.</p>
          </div>
          <button class="icon-button" type="button" aria-label="Close settings" @click="requestClose">×</button>
        </header>

        <div class="settings-meta-bar">
          <span :class="['write-state', writable ? 'good' : 'bad']">
            {{ writable ? 'Configuration is writable' : 'Configuration is read-only' }}
          </span>
          <span class="settings-path" :title="configPath">{{ configPath || 'Loading configuration…' }}</span>
        </div>

        <nav class="settings-tabs" aria-label="Settings sections">
          <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
            {{ tab.label }}
          </button>
        </nav>

        <div class="settings-body">
          <div v-if="loading" class="settings-loading large">Loading configuration…</div>
          <div v-else-if="loadError" class="alert settings-alert" role="alert">
            <strong>Unable to load settings.</strong>
            <span>{{ loadError }}</span>
            <button class="btn secondary compact" type="button" @click="load">Try again</button>
          </div>
          <template v-else-if="draft">
            <div v-if="activeTab === 'devices'" class="settings-device-layout">
              <aside class="settings-node-list">
                <div class="settings-node-list-head">
                  <div>
                    <strong>Devices</strong>
                    <span>{{ draft.kvms.length }} configured</span>
                  </div>
                  <button class="btn secondary compact" type="button" @click="addNode">Add</button>
                </div>
                <button
                  v-for="(node, index) in draft.kvms"
                  :key="`${node.id}-${index}`"
                  type="button"
                  class="settings-node-item"
                  :class="{ active: selectedNodeIndex === index }"
                  @click="selectedNodeIndex = index"
                >
                  <span class="settings-node-avatar">{{ (node.name || '?').slice(0, 1).toUpperCase() }}</span>
                  <span>
                    <strong>{{ node.name || 'Unnamed node' }}</strong>
                    <small>{{ node.id || 'missing-id' }}</small>
                  </span>
                </button>
                <div v-if="!draft.kvms.length" class="settings-empty-inline">No devices configured.</div>
              </aside>

              <div class="settings-editor-scroll">
                <NodeConfigEditor
                  v-if="selectedNode"
                  :key="`${selectedNode.id}-${selectedNodeIndex}`"
                  :node="selectedNode"
                  @remove="removeSelectedNode"
                />
                <div v-else class="settings-empty-large">
                  <h3>Add your first device</h3>
                  <p>A node can contain a LuckFox KVM, a host agent, or both.</p>
                  <button class="btn primary" type="button" @click="addNode">Add device</button>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'server'" class="settings-editor-scroll single-column">
              <section class="settings-card">
                <div class="settings-card-title">
                  <div>
                    <h4>Dashboard server</h4>
                    <p>Polling and request timeouts apply immediately. Host and port changes require a restart.</p>
                  </div>
                </div>
                <div class="form-grid two">
                  <label class="field">
                    <span>Bind host</span>
                    <input v-model.trim="server.host" placeholder="0.0.0.0" />
                    <small>Use 0.0.0.0 for LAN and Docker access.</small>
                  </label>
                  <label class="field">
                    <span>Port</span>
                    <input v-model.number="server.port" type="number" min="1" max="65535" />
                  </label>
                  <label class="field">
                    <span>KVM request timeout (ms)</span>
                    <input v-model.number="server.requestTimeoutMs" type="number" min="100" step="100" />
                  </label>
                  <label class="field">
                    <span>Dashboard refresh interval (ms)</span>
                    <input v-model.number="server.pollIntervalMs" type="number" min="1000" step="1000" />
                  </label>
                </div>
                <div class="restart-note">
                  Restart required after changing: <code>{{ restartRequiredFields.join(', ') }}</code>
                </div>
              </section>
            </div>

            <div v-else-if="activeTab === 'json'" class="settings-editor-scroll single-column">
              <section class="settings-card json-editor-card">
                <div class="settings-card-title split">
                  <div>
                    <h4>Raw JSON</h4>
                    <p>Edit the complete file directly. Apply JSON to the form before saving.</p>
                  </div>
                  <button class="btn secondary compact" type="button" @click="applyRawJson">Apply JSON</button>
                </div>
                <textarea v-model="rawJson" class="raw-json-editor" spellcheck="false" aria-label="Raw kvm.config.json" />
                <p v-if="rawJsonError" class="field-error">{{ rawJsonError }}</p>
              </section>
            </div>

            <div v-else class="settings-editor-scroll single-column">
              <BackupManager
                :backups="backups"
                :max-backups="maxBackups"
                :busy="backupBusy"
                @create="createBackup"
                @restore="restoreBackup"
                @delete="deleteBackup"
              />
              <section class="settings-card backup-location-card">
                <h4>Backup location</h4>
                <code>{{ backupPath }}</code>
                <p>Mount this folder from the host when using Docker so backups survive container recreation.</p>
              </section>
            </div>
          </template>
        </div>

        <footer class="settings-footer">
          <div class="settings-feedback" :class="feedbackTone">{{ feedback }}</div>
          <div class="settings-footer-actions">
            <button class="btn secondary" type="button" :disabled="saving" @click="requestClose">Close</button>
            <button class="btn primary" type="button" :disabled="saving || loading || !draft || !writable" @click="save">
              <span v-if="saving" class="spinner" />
              {{ saving ? 'Saving' : 'Save configuration' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import BackupManager from './BackupManager.vue';
import NodeConfigEditor from './NodeConfigEditor.vue';
import {
  createConfigBackup,
  deleteConfigBackup,
  fetchConfigBackups,
  fetchDashboardConfig,
  restoreConfigBackup,
  saveDashboardConfig
} from '../services/configApi';
import {
  cloneConfig,
  createDefaultNode,
  nextNodeIndex,
  normalizeEditableConfig
} from '../services/configEditor';
import type { ConfigBackupSummary, DashboardConfig, DashboardNodeConfig, DashboardServerConfig } from '../types/config';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; saved: [] }>();

type SettingsTab = 'devices' | 'server' | 'json' | 'backups';
const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'devices', label: 'Devices' },
  { id: 'server', label: 'Server' },
  { id: 'json', label: 'Raw JSON' },
  { id: 'backups', label: 'Backups' }
];

const activeTab = ref<SettingsTab>('devices');
const loading = ref(false);
const saving = ref(false);
const backupBusy = ref(false);
const loadError = ref('');
const feedback = ref('');
const feedbackTone = ref('');
const draft = ref<DashboardConfig | null>(null);
const baselineJson = ref('');
const rawJson = ref('');
const rawJsonError = ref('');
const selectedNodeIndex = ref(0);
const backups = ref<ConfigBackupSummary[]>([]);
const maxBackups = ref(10);
const writable = ref(false);
const configPath = ref('');
const backupPath = ref('');
const restartRequiredFields = ref<string[]>(['server.host', 'server.port']);

const selectedNode = computed<DashboardNodeConfig | null>(() => draft.value?.kvms[selectedNodeIndex.value] || null);
const server = computed<DashboardServerConfig>(() => {
  if (!draft.value) return {};
  draft.value.server ||= {};
  return draft.value.server;
});
const dirty = computed(() => Boolean(
  draft.value && (JSON.stringify(draft.value) !== baselineJson.value || rawJson.value !== JSON.stringify(draft.value, null, 2))
));

watch(() => props.open, (value) => {
  if (value) void load();
});

watch(activeTab, (tab) => {
  if (tab === 'json' && draft.value) {
    rawJson.value = JSON.stringify(draft.value, null, 2);
    rawJsonError.value = '';
  }
});

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  feedback.value = '';
  rawJsonError.value = '';
  try {
    const [configData, backupData] = await Promise.all([fetchDashboardConfig(), fetchConfigBackups()]);
    const normalized = normalizeEditableConfig(configData.config);
    draft.value = normalized;
    baselineJson.value = JSON.stringify(normalized);
    rawJson.value = JSON.stringify(normalized, null, 2);
    backups.value = backupData.backups;
    maxBackups.value = configData.maxBackups || backupData.maxBackups || 10;
    writable.value = configData.writable;
    configPath.value = configData.configPath;
    backupPath.value = configData.backupPath;
    restartRequiredFields.value = configData.restartRequiredFields;
    selectedNodeIndex.value = Math.min(selectedNodeIndex.value, Math.max(0, normalized.kvms.length - 1));
  } catch (error) {
    loadError.value = message(error);
  } finally {
    loading.value = false;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setFeedback(text: string, tone = 'good'): void {
  feedback.value = text;
  feedbackTone.value = tone;
}

function syncRawJson(): void {
  if (draft.value) rawJson.value = JSON.stringify(draft.value, null, 2);
}

function addNode(): void {
  if (!draft.value) return;
  const node = createDefaultNode(nextNodeIndex(draft.value));
  draft.value.kvms.push(node);
  selectedNodeIndex.value = draft.value.kvms.length - 1;
  activeTab.value = 'devices';
  syncRawJson();
}

function removeSelectedNode(): void {
  if (!draft.value || !selectedNode.value) return;
  if (!window.confirm(`Delete ${selectedNode.value.name || selectedNode.value.id} from the configuration?`)) return;
  draft.value.kvms.splice(selectedNodeIndex.value, 1);
  selectedNodeIndex.value = Math.min(selectedNodeIndex.value, Math.max(0, draft.value.kvms.length - 1));
  syncRawJson();
}

function applyRawJson(): boolean {
  rawJsonError.value = '';
  try {
    const parsed = JSON.parse(rawJson.value) as DashboardConfig;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.kvms)) {
      throw new Error('The JSON must contain a kvms array.');
    }
    draft.value = normalizeEditableConfig(parsed);
    selectedNodeIndex.value = Math.min(selectedNodeIndex.value, Math.max(0, draft.value.kvms.length - 1));
    rawJson.value = JSON.stringify(draft.value, null, 2);
    setFeedback('Raw JSON applied to the form. Save to write it to disk.');
    return true;
  } catch (error) {
    rawJsonError.value = message(error);
    setFeedback('The raw JSON could not be applied.', 'bad');
    return false;
  }
}

async function save(): Promise<void> {
  if (!draft.value) return;
  if (activeTab.value === 'json' && !applyRawJson()) return;
  saving.value = true;
  setFeedback('');
  try {
    const response = await saveDashboardConfig(cloneConfig(draft.value));
    const saved = normalizeEditableConfig(response.config || draft.value);
    draft.value = saved;
    baselineJson.value = JSON.stringify(saved);
    rawJson.value = JSON.stringify(saved, null, 2);
    backups.value = response.backups;
    setFeedback(`Saved. Backup created: ${response.backup?.name || 'complete'}`);
    emit('saved');
  } catch (error) {
    setFeedback(message(error), 'bad');
  } finally {
    saving.value = false;
  }
}

async function createBackup(): Promise<void> {
  backupBusy.value = true;
  try {
    const response = await createConfigBackup();
    backups.value = response.backups;
    setFeedback(`Backup created: ${response.backup?.name || 'complete'}`);
  } catch (error) {
    setFeedback(message(error), 'bad');
  } finally {
    backupBusy.value = false;
  }
}

async function deleteBackup(name: string): Promise<void> {
  if (!window.confirm(`Delete backup ${name}?`)) return;
  backupBusy.value = true;
  try {
    const response = await deleteConfigBackup(name);
    backups.value = response.backups;
    setFeedback(`Deleted ${name}`);
  } catch (error) {
    setFeedback(message(error), 'bad');
  } finally {
    backupBusy.value = false;
  }
}

async function restoreBackup(name: string): Promise<void> {
  if (!window.confirm(`Restore ${name}? The current configuration will be backed up first.`)) return;
  backupBusy.value = true;
  try {
    const response = await restoreConfigBackup(name);
    backups.value = response.backups;
    if (response.config) {
      const restored = normalizeEditableConfig(response.config);
      draft.value = restored;
      baselineJson.value = JSON.stringify(restored);
      rawJson.value = JSON.stringify(restored, null, 2);
      selectedNodeIndex.value = Math.min(selectedNodeIndex.value, Math.max(0, restored.kvms.length - 1));
    }
    setFeedback(`Restored ${name}`);
    emit('saved');
  } catch (error) {
    setFeedback(message(error), 'bad');
  } finally {
    backupBusy.value = false;
  }
}

function requestClose(): void {
  if (dirty.value && !window.confirm('Close settings and discard unsaved changes?')) return;
  emit('close');
}
</script>
