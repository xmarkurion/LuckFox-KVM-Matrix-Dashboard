import type {
  DashboardConfig,
  DashboardHostAgentConfig,
  DashboardKvmEndpointConfig,
  DashboardNodeConfig,
  DashboardScriptConfig
} from '../types/config';

export function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultScript(index = 1): DashboardScriptConfig {
  return {
    id: `script${index}`,
    label: `Script ${index}`,
    description: '',
    enabled: true
  };
}

export function createDefaultNode(index = 1): DashboardNodeConfig {
  return {
    id: `node-${index}`,
    name: `Node ${index}`,
    notes: '',
    kvm: {
      enabled: false,
      ip: '',
      password: '',
      protocol: 'http',
      hostMacAddress: ''
    },
    hostAgent: {
      enabled: false,
      url: '',
      token: '',
      timeoutMs: 60000,
      scripts: []
    }
  };
}

export function ensureKvmConfig(node: DashboardNodeConfig): DashboardKvmEndpointConfig {
  if (!node.kvm) {
    node.kvm = {
      enabled: false,
      ip: '',
      password: '',
      protocol: 'http',
      hostMacAddress: ''
    };
  }
  node.kvm.protocol ||= 'http';
  return node.kvm;
}

export function ensureHostAgentConfig(node: DashboardNodeConfig): DashboardHostAgentConfig {
  if (!node.hostAgent) {
    node.hostAgent = {
      enabled: false,
      url: '',
      token: '',
      timeoutMs: 60000,
      scripts: []
    };
  }
  node.hostAgent.scripts ||= [];
  return node.hostAgent;
}

export function normalizeEditableConfig(source: DashboardConfig): DashboardConfig {
  const config = cloneConfig(source);
  config.server ||= {};
  config.server.host ||= '0.0.0.0';
  config.server.port ||= 8787;
  config.server.requestTimeoutMs ||= 8000;
  config.server.pollIntervalMs ||= 15000;
  config.kvms ||= [];

  for (const node of config.kvms) {
    ensureKvmConfig(node);
    ensureHostAgentConfig(node);
  }

  return config;
}

export function nextNodeIndex(config: DashboardConfig): number {
  let index = config.kvms.length + 1;
  const ids = new Set(config.kvms.map((node) => node.id));
  while (ids.has(`node-${index}`)) index += 1;
  return index;
}
