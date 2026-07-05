export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface HostScriptSummary {
  id: string;
  label: string;
  description: string;
}

export interface KvmSummary {
  id: string;
  name: string;
  /** True when this card has an enabled LuckFox KVM endpoint. False means host-agent-only. */
  kvmEnabled: boolean;
  /** LuckFox KVM device IP or host from kvm.config.json. Empty when kvmEnabled is false. */
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

export interface VideoState extends JsonObject {
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

export interface KvmStatus extends KvmSummary {
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

export type ActionPayload = JsonObject;

export interface PanelActionEvent {
  action: string;
  payload: ActionPayload;
}

export interface KvmActionEvent extends PanelActionEvent {
  id: string;
}

export interface KvmsResponse {
  kvms: KvmSummary[];
  pollIntervalMs: number;
}

export interface StatusesResponse {
  kvms: KvmStatus[];
}

export interface ApiSuccess<T = JsonValue | undefined> {
  ok?: true;
  result?: T;
}

export interface ApiFailure {
  ok: false;
  error: string;
  data?: unknown;
}

export interface RawRpcRequest {
  method: string;
  params: ActionPayload;
}

export type KvmStatusMap = Record<string, KvmStatus | undefined>;
export type BusyMap = Record<string, string | undefined>;
