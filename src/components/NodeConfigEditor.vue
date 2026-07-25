<template>
  <div class="settings-node-editor">
    <div class="settings-section-heading">
      <div>
        <p class="eyebrow">Device configuration</p>
        <h3>{{ node.name || 'Unnamed node' }}</h3>
      </div>
      <button class="btn danger compact" type="button" @click="$emit('remove')">Delete node</button>
    </div>

    <section class="settings-card">
      <div class="settings-card-title">
        <div>
          <h4>Identity</h4>
          <p>Name, stable ID and notes shown on the dashboard.</p>
        </div>
      </div>
      <div class="form-grid two">
        <label class="field">
          <span>Node ID</span>
          <input v-model.trim="node.id" autocomplete="off" placeholder="lmde" />
          <small>Used in API routes. Keep it unique and avoid changing it unnecessarily.</small>
        </label>
        <label class="field">
          <span>Display name</span>
          <input v-model.trim="node.name" autocomplete="off" placeholder="LMDE" />
        </label>
        <label class="field full">
          <span>Notes</span>
          <textarea v-model="node.notes" rows="2" placeholder="What this machine is used for" />
        </label>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-card-title split">
        <div>
          <h4>LuckFox KVM</h4>
          <p>Disable this section for agent-only machines.</p>
        </div>
        <label class="switch-control">
          <input v-model="kvm.enabled" type="checkbox" />
          <span>{{ kvm.enabled ? 'Enabled' : 'Disabled' }}</span>
        </label>
      </div>
      <div class="form-grid two" :class="{ disabled: !kvm.enabled }">
        <label class="field">
          <span>KVM IP or hostname</span>
          <input v-model.trim="kvm.ip" :disabled="!kvm.enabled" placeholder="192.168.10.92" />
        </label>
        <label class="field">
          <span>Protocol</span>
          <select v-model="kvm.protocol" :disabled="!kvm.enabled">
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </label>
        <label class="field">
          <span>KVM password</span>
          <div class="secret-input">
            <input v-model="kvm.password" :type="showKvmPassword ? 'text' : 'password'" :disabled="!kvm.enabled" autocomplete="new-password" />
            <button type="button" :disabled="!kvm.enabled" @click="showKvmPassword = !showKvmPassword">
              {{ showKvmPassword ? 'Hide' : 'Show' }}
            </button>
          </div>
        </label>
        <label class="field">
          <span>PC MAC address</span>
          <input v-model.trim="kvm.hostMacAddress" :disabled="!kvm.enabled" placeholder="AA:BB:CC:DD:EE:FF" />
          <small>Optional. Required only for Wake-on-LAN.</small>
        </label>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-card-title split">
        <div>
          <h4>Host agent</h4>
          <p>PC health, system statistics and host scripts.</p>
        </div>
        <label class="switch-control">
          <input v-model="agent.enabled" type="checkbox" />
          <span>{{ agent.enabled ? 'Enabled' : 'Disabled' }}</span>
        </label>
      </div>
      <div class="form-grid two" :class="{ disabled: !agent.enabled }">
        <label class="field full">
          <span>Agent URL</span>
          <input v-model.trim="agent.url" :disabled="!agent.enabled" placeholder="http://192.168.10.92:8799" />
        </label>
        <label class="field">
          <span>Agent token</span>
          <div class="secret-input">
            <input v-model="agent.token" :type="showAgentToken ? 'text' : 'password'" :disabled="!agent.enabled" autocomplete="new-password" />
            <button type="button" :disabled="!agent.enabled" @click="showAgentToken = !showAgentToken">
              {{ showAgentToken ? 'Hide' : 'Show' }}
            </button>
          </div>
        </label>
        <label class="field">
          <span>Default timeout (ms)</span>
          <input v-model.number="agent.timeoutMs" type="number" min="100" step="100" :disabled="!agent.enabled" />
        </label>
      </div>

      <div class="script-editor-header">
        <div>
          <h5>Dashboard scripts</h5>
          <p>Each entry maps to a Python file with the same ID on the host agent.</p>
        </div>
        <button class="btn secondary compact" type="button" :disabled="!agent.enabled" @click="addScript">Add script</button>
      </div>

      <div v-if="agent.scripts?.length" class="script-editor-list" :class="{ disabled: !agent.enabled }">
        <article v-for="(script, index) in agent.scripts" :key="`${script.id}-${index}`" class="script-editor-row">
          <div class="script-editor-topline">
            <strong>Script {{ index + 1 }}</strong>
            <div class="row-actions">
              <button type="button" :disabled="index === 0 || !agent.enabled" @click="moveScript(index, -1)">↑</button>
              <button type="button" :disabled="index === (agent.scripts?.length || 0) - 1 || !agent.enabled" @click="moveScript(index, 1)">↓</button>
              <button class="danger-text" type="button" :disabled="!agent.enabled" @click="removeScript(index)">Remove</button>
            </div>
          </div>
          <div class="form-grid two">
            <label class="field">
              <span>Script ID / filename</span>
              <input v-model.trim="script.id" :disabled="!agent.enabled" placeholder="backup_database" />
            </label>
            <label class="field">
              <span>Dashboard label</span>
              <input v-model.trim="script.label" :disabled="!agent.enabled" placeholder="Backup database" />
            </label>
            <label class="field full">
              <span>Description</span>
              <input v-model="script.description" :disabled="!agent.enabled" placeholder="Shown under the script name" />
            </label>
            <label class="field">
              <span>Timeout override (ms)</span>
              <input v-model.number="script.timeoutMs" type="number" min="100" step="100" :disabled="!agent.enabled" placeholder="Use agent default" />
            </label>
            <label class="switch-control inline-switch">
              <input v-model="script.enabled" type="checkbox" :disabled="!agent.enabled" />
              <span>Show this script</span>
            </label>
          </div>
        </article>
      </div>
      <div v-else class="settings-empty-inline">No scripts configured for this host agent.</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { createDefaultScript, ensureHostAgentConfig, ensureKvmConfig } from '../services/configEditor';
import type { DashboardNodeConfig } from '../types/config';

const props = defineProps<{ node: DashboardNodeConfig }>();
defineEmits<{ remove: [] }>();

const showKvmPassword = ref(false);
const showAgentToken = ref(false);
const kvm = computed(() => ensureKvmConfig(props.node));
const agent = computed(() => ensureHostAgentConfig(props.node));

function addScript(): void {
  const scripts = agent.value.scripts ||= [];
  let index = scripts.length + 1;
  const ids = new Set(scripts.map((script) => script.id));
  while (ids.has(`script${index}`)) index += 1;
  scripts.push(createDefaultScript(index));
}

function removeScript(index: number): void {
  agent.value.scripts?.splice(index, 1);
}

function moveScript(index: number, direction: -1 | 1): void {
  const scripts = agent.value.scripts;
  if (!scripts) return;
  const target = index + direction;
  if (target < 0 || target >= scripts.length) return;
  const [script] = scripts.splice(index, 1);
  scripts.splice(target, 0, script);
}
</script>
