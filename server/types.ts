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

export interface KvmConfigEntry {
  id: string;
  name: string;
  ip: string;
  password: string;
  notes?: string;
  protocol?: 'http' | 'https';
  hostMacAddress?: string;
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
}

export interface VideoState extends JsonRecord {
  ready?: boolean;
  width?: number;
  height?: number;
  fps?: number;
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
