export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];
export interface JsonRecord {
  [key: string]: JsonValue | undefined;
}

export interface ServerConfig {
  port?: number;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface HostScriptEntry {
  id: string;
  label: string;
  description?: string;
  timeoutMs?: number;
  enabled?: boolean;
}

export interface HostAgentConfig {
  enabled?: boolean;
  url: string;
  token?: string;
  timeoutMs?: number;
  scripts?: HostScriptEntry[];
}

/** Legacy single-script config kept so older kvm.config.json files still work. */
export interface LegacyHostScriptConfig {
  enabled?: boolean;
  url: string;
  token?: string;
  label?: string;
  timeoutMs?: number;
}

export interface KvmConfigEntry {
  id: string;
  name: string;
  ip: string;
  password: string;
  notes?: string;
  protocol?: 'http' | 'https';
  hostMacAddress?: string;
  hostAgent?: HostAgentConfig;
  hostScript?: LegacyHostScriptConfig;
}

export interface AppConfig {
  server?: ServerConfig;
  kvms: KvmConfigEntry[];
}

export interface HostScriptSummary {
  id: string;
  label: string;
  description: string;
}

export interface PublicKvm {
  id: string;
  name: string;
  /** LuckFox KVM device IP or host from kvm.config.json. */
  ip: string;
  /** Full URL used to open the LuckFox KVM web UI. */
  websiteUrl: string;
  /** Full URL used to reach the PC host-agent. Empty when no agent is configured. */
  pcUrl: string;
  /** Host/IP extracted from pcUrl for display. Empty when no agent is configured. */
  pcIp: string;
  notes: string;
  hasWolMac: boolean;
  hasHostScript: boolean;
  hostScriptLabel: string;
  hostScripts: HostScriptSummary[];
}

export interface PcReachability {
  responds: boolean;
  latencyMs: number | null;
  checkedAt: string;
  error: string;
}

export interface VideoState extends JsonRecord {
  ready?: boolean;
  width?: number;
  height?: number;
  fps?: number;
  error?: string;
}

export interface HostStatsMemory {
  totalBytes?: number;
  availableBytes?: number;
  usedBytes?: number;
  freeBytes?: number;
  percent?: number;
}

export interface HostStatsCpu {
  percent?: number;
  countLogical?: number;
  countPhysical?: number | null;
  loadAverage?: number[] | null;
  frequencyMhz?: JsonValue;
}

export interface HostStatsDisk {
  path?: string;
  device?: string;
  mountpoint?: string;
  fstype?: string;
  totalBytes?: number;
  usedBytes?: number;
  freeBytes?: number;
  percent?: number;
}

export interface HostStatsDocker {
  containerized?: boolean;
  psutilProcfsPath?: string;
  hostProcMounted?: boolean;
  hostRootMounted?: boolean;
  cgroup?: JsonValue;
}

export interface HostStatsPlatform {
  system?: string;
  release?: string;
  version?: string;
  machine?: string;
  pythonVersion?: string;
  osName?: string;
}

export interface HostStats {
  ok?: boolean;
  service?: string;
  collectedAt?: string;
  hostname?: string;
  platform?: HostStatsPlatform;
  docker?: HostStatsDocker;
  uptimeSeconds?: number;
  bootTime?: string;
  cpu?: HostStatsCpu;
  memory?: HostStatsMemory;
  swap?: HostStatsMemory;
  disks?: HostStatsDisk[];
  network?: JsonValue;
  temperatures?: JsonValue;
  topProcesses?: JsonValue;
  battery?: JsonValue;
  error?: string;
}

export interface KvmStatus extends PublicKvm {
  kvmResponds: boolean;
  authenticated: boolean;
  pcResponds: boolean;
  pcLatencyMs: number | null;
  pcCheckedAt: string;
  pcError: string;
  deviceId: string;
  video: VideoState | null;
  usb: JsonValue | undefined;
  keyboardLeds: JsonValue | undefined;
  hostPower: string;
  hostStats: HostStats | null;
  hostStatsError: string;
  latencyMs: number | null;
  checkedAt: string;
  error: string;
}

export interface SessionState {
  cookie: string;
  loggedInAt: string;
}

export interface RpcErrorEnvelope {
  code?: number;
  message?: string;
  data?: unknown;
}

export interface JsonRpcRequestPayload {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: JsonRecord;
}

export interface JsonRpcEnvelope<T = JsonValue> {
  jsonrpc?: '2.0';
  id?: number;
  result?: T;
  error?: RpcErrorEnvelope;
}

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

export interface ServerAction {
  id: string;
  label: string;
  danger?: boolean;
  rpc: string;
  params?: string[];
}

export type RequestBody = Record<string, unknown>;
