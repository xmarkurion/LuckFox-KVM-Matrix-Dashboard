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

export interface HostScriptConfig {
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
  hostScript?: HostScriptConfig;
}

export interface AppConfig {
  server?: ServerConfig;
  kvms: KvmConfigEntry[];
}

export interface PublicKvm {
  id: string;
  name: string;
  ip: string;
  notes: string;
  websiteUrl: string;
  hasWolMac: boolean;
  hasHostScript: boolean;
  hostScriptLabel: string;
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
