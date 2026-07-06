import express, { type NextFunction, type Request, type Response as ExpressResponse } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ApiError,
  AppConfig,
  JsonRecord,
  JsonRpcEnvelope,
  JsonRpcRequestPayload,
  JsonValue,
  HostAgentConfig,
  HostScriptEntry,
  HostStats,
  KvmConfigEntry,
  KvmEndpointConfig,
  KvmStatus,
  PublicKvm,
  RequestBody,
  ServerAction,
  SessionState,
  VideoState
} from './types';

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = process.env.KVM_CONFIG || path.join(ROOT, 'kvm.config.json');
export const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as AppConfig;
const PORT = Number(process.env.PORT || config.server?.port || 8787);
const HOST = String(process.env.HOST || config.server?.host || '0.0.0.0');
const REQUEST_TIMEOUT_MS = Number(config.server?.requestTimeoutMs || 8000);

export const app = express();
app.use(express.json({ limit: '1mb' }));

const sessions = new Map<string, SessionState>();

export const MODIFIER_BITS: Record<string, number> = {
  ctrl: 0x01,
  control: 0x01,
  shift: 0x02,
  alt: 0x04,
  option: 0x04,
  win: 0x08,
  meta: 0x08,
  cmd: 0x08,
  command: 0x08,
  gui: 0x08,
  super: 0x08
};

export const KEYNAME_TO_KEYCODE: Record<string, number> = {
  a: 0x04, b: 0x05, c: 0x06, d: 0x07, e: 0x08, f: 0x09, g: 0x0a, h: 0x0b, i: 0x0c,
  j: 0x0d, k: 0x0e, l: 0x0f, m: 0x10, n: 0x11, o: 0x12, p: 0x13, q: 0x14,
  r: 0x15, s: 0x16, t: 0x17, u: 0x18, v: 0x19, w: 0x1a, x: 0x1b, y: 0x1c, z: 0x1d,
  '1': 0x1e, '2': 0x1f, '3': 0x20, '4': 0x21, '5': 0x22, '6': 0x23, '7': 0x24, '8': 0x25, '9': 0x26, '0': 0x27,
  enter: 0x28, return: 0x28, esc: 0x29, escape: 0x29, backspace: 0x2a, tab: 0x2b, space: 0x2c, ' ': 0x2c,
  '-': 0x2d, minus: 0x2d, '=': 0x2e, equal: 0x2e, equals: 0x2e, '[': 0x2f, leftbracket: 0x2f,
  ']': 0x30, rightbracket: 0x30, '\\': 0x31, backslash: 0x31, ';': 0x33, semicolon: 0x33,
  "'": 0x34, apostrophe: 0x34, quote: 0x34, '`': 0x35, grave: 0x35, backtick: 0x35,
  ',': 0x36, comma: 0x36, '.': 0x37, period: 0x37, dot: 0x37, '/': 0x38, slash: 0x38,
  capslock: 0x39, caps: 0x39,
  f1: 0x3a, f2: 0x3b, f3: 0x3c, f4: 0x3d, f5: 0x3e, f6: 0x3f, f7: 0x40, f8: 0x41, f9: 0x42, f10: 0x43, f11: 0x44, f12: 0x45,
  printscreen: 0x46, prtsc: 0x46, scrolllock: 0x47, pause: 0x48, break: 0x48,
  insert: 0x49, ins: 0x49, home: 0x4a, pageup: 0x4b, pgup: 0x4b, delete: 0x4c, del: 0x4c,
  end: 0x4d, pagedown: 0x4e, pgdn: 0x4e, right: 0x4f, arrowright: 0x4f, left: 0x50,
  arrowleft: 0x50, down: 0x51, arrowdown: 0x51, up: 0x52, arrowup: 0x52, menu: 0x65, app: 0x65
};

export const MOUSE_BUTTON_BITS: Record<string, number> = { left: 0x01, right: 0x02, middle: 0x04 };

type HidMapping = [keycode: number, requiresShift: boolean];

type AsciiToHidTable = Record<string, HidMapping>;

function httpError(message: string, status = 500, data?: unknown): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  if (data !== undefined) error.data = data;
  return error;
}

export function buildAsciiToHid(): AsciiToHidTable {
  const table: AsciiToHidTable = {};
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    table[ch] = [KEYNAME_TO_KEYCODE[ch], false];
    table[ch.toUpperCase()] = [KEYNAME_TO_KEYCODE[ch], true];
  }
  const digitShifted: Record<string, string> = { '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')' };
  for (const [digit, symbol] of Object.entries(digitShifted)) {
    table[digit] = [KEYNAME_TO_KEYCODE[digit], false];
    table[symbol] = [KEYNAME_TO_KEYCODE[digit], true];
  }
  const punct: [string, string, number][] = [
    ['-', '_', KEYNAME_TO_KEYCODE['-']], ['=', '+', KEYNAME_TO_KEYCODE['=']], ['[', '{', KEYNAME_TO_KEYCODE['[']],
    [']', '}', KEYNAME_TO_KEYCODE[']']], ['\\', '|', KEYNAME_TO_KEYCODE['\\']], [';', ':', KEYNAME_TO_KEYCODE[';']],
    ["'", '"', KEYNAME_TO_KEYCODE["'"]], ['`', '~', KEYNAME_TO_KEYCODE['`']], [',', '<', KEYNAME_TO_KEYCODE[',']],
    ['.', '>', KEYNAME_TO_KEYCODE['.']], ['/', '?', KEYNAME_TO_KEYCODE['/']]
  ];
  for (const [low, high, keycode] of punct) {
    table[low] = [keycode, false];
    table[high] = [keycode, true];
  }
  table[' '] = [KEYNAME_TO_KEYCODE.space, false];
  table['\n'] = [KEYNAME_TO_KEYCODE.enter, false];
  table['\t'] = [KEYNAME_TO_KEYCODE.tab, false];
  return table;
}

const ASCII_TO_HID = buildAsciiToHid();

const ACTIONS: ServerAction[] = [
  { id: 'power', label: 'Power press', danger: false, rpc: 'triggerPower' },
  { id: 'reset', label: 'Reset press', danger: true, rpc: 'triggerReset' },
  { id: 'usbWakeup', label: 'USB wakeup', rpc: 'sendUsbWakeupSignal' },
  { id: 'wol', label: 'Wake-on-LAN', rpc: 'sendWOLMagicPacket', params: ['macAddress'] },
  { id: 'arrowUp', label: 'Arrow Up', rpc: 'keyboardReport' },
  { id: 'hostScript', label: 'Run configured host script', rpc: 'hostScript', params: ['scriptId'] },
  { id: 'ctrlAltDel', label: 'Ctrl+Alt+Del', rpc: 'keyboardReport' },
  { id: 'keyPress', label: 'Key press', rpc: 'keyboardReport', params: ['key'] },
  { id: 'keyCombo', label: 'Key combo', rpc: 'keyboardReport', params: ['combo'] },
  { id: 'typeText', label: 'Type text', rpc: 'keyboardReport', params: ['text'] },
  { id: 'absMouseReport', label: 'Absolute mouse', rpc: 'absMouseReport', params: ['x', 'y', 'buttons'] },
  { id: 'relMouseReport', label: 'Relative mouse', rpc: 'relMouseReport', params: ['dx', 'dy', 'buttons'] },
  { id: 'wheelReport', label: 'Mouse wheel', rpc: 'wheelReport', params: ['wheelY'] },
  { id: 'click', label: 'Mouse click', rpc: 'absMouseReport', params: ['x', 'y', 'button'] },
  { id: 'mountWithHTTP', label: 'Mount remote image', rpc: 'mountWithHTTP', params: ['url', 'mode'] },
  { id: 'mountWithStorage', label: 'Mount stored image', rpc: 'mountWithStorage', params: ['filename', 'mode'] },
  { id: 'mountBuiltInImage', label: 'Mount built-in image', rpc: 'mountBuiltInImage', params: ['filename'] },
  { id: 'unmountImage', label: 'Unmount image', rpc: 'unmountImage' },
  { id: 'rebootKvm', label: 'Reboot KVM', danger: true, rpc: 'reboot', params: ['force'] },
  { id: 'rawRpc', label: 'Raw JSON-RPC', rpc: '*', params: ['method', 'params'] }
];

function normalizeId(id: unknown): string {
  return String(id || '').trim().toLowerCase();
}

function routeParam(value: unknown, label: string): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (typeof resolved !== 'string' || !resolved.trim()) {
    throw httpError(`Missing route parameter: ${label}`, 400);
  }
  return resolved;
}

function findKvm(id: string): KvmConfigEntry {
  const normalized = normalizeId(id);
  const kvm = config.kvms.find((entry) => normalizeId(entry.id) === normalized);
  if (!kvm) throw httpError(`Unknown KVM id: ${id}`, 404);
  return kvm;
}

interface ResolvedKvmEndpoint {
  enabled: boolean;
  ip: string;
  password: string;
  protocol: 'http' | 'https';
  hostMacAddress: string;
}

function resolvedKvmEndpoint(entry: KvmConfigEntry): ResolvedKvmEndpoint {
  const nested: KvmEndpointConfig = entry.kvm && typeof entry.kvm === 'object' ? entry.kvm : {};
  const ip = String(nested.ip ?? entry.ip ?? '').trim();
  const password = String(nested.password ?? entry.password ?? '').trim();
  const protocol = nested.protocol || entry.protocol || 'http';
  const hostMacAddress = String(nested.hostMacAddress ?? entry.hostMacAddress ?? '').trim();
  const explicitlyDisabled = entry.kvm === false || nested.enabled === false || entry.kvmEnabled === false;

  return {
    enabled: !explicitlyDisabled && Boolean(ip && password),
    ip,
    password,
    protocol,
    hostMacAddress
  };
}

function ensureKvmEnabled(entry: KvmConfigEntry): ResolvedKvmEndpoint {
  const endpoint = resolvedKvmEndpoint(entry);
  if (!endpoint.enabled) {
    throw httpError(`LuckFox KVM is not configured/enabled for ${entry.name}`, 400);
  }
  return endpoint;
}

function baseUrl(kvm: KvmConfigEntry): string {
  const endpoint = ensureKvmEnabled(kvm);
  const ip = endpoint.ip.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${endpoint.protocol}://${ip}`;
}

const DEFAULT_HOST_SCRIPT_ID = 'host_action';

type NormalizedHostScript = HostScriptEntry & { id: string; label: string; description: string };

interface NormalizedHostAgent {
  enabled: boolean;
  url: string;
  token?: string;
  timeoutMs?: number;
  scripts: NormalizedHostScript[];
}

function normalizeScriptId(value: unknown): string {
  return String(value || '').trim();
}

function normalizeHostScript(script: HostScriptEntry, fallbackLabel: string): NormalizedHostScript | null {
  const id = normalizeScriptId(script.id);
  if (!id || script.enabled === false) return null;

  return {
    id,
    label: String(script.label || fallbackLabel || id),
    description: String(script.description || ''),
    timeoutMs: script.timeoutMs,
    enabled: script.enabled
  };
}

function hostAgentConfig(kvm: KvmConfigEntry): NormalizedHostAgent | null {
  const legacy = kvm.hostScript;
  const source: HostAgentConfig | undefined = kvm.hostAgent || (legacy
    ? {
        enabled: legacy.enabled,
        url: legacy.url,
        token: legacy.token,
        timeoutMs: legacy.timeoutMs,
        scripts: [{
          id: DEFAULT_HOST_SCRIPT_ID,
          label: legacy.label || 'Run Host Script',
          description: 'Legacy single-script host action.'
        }]
      }
    : undefined);

  const url = source?.url?.trim().replace(/\/$/, '');
  if (!source || !url || source.enabled === false) return null;

  const configuredScripts = Array.isArray(source.scripts) ? source.scripts : [];
  let scripts = configuredScripts
    .map((script) => normalizeHostScript(script, 'Run Host Script'))
    .filter((script): script is NormalizedHostScript => Boolean(script));

  if (!scripts.length) {
    scripts = [{
      id: DEFAULT_HOST_SCRIPT_ID,
      label: legacy?.label || 'Run Host Script',
      description: 'Default editable host action.'
    }];
  }

  return {
    enabled: true,
    url,
    token: source.token,
    timeoutMs: source.timeoutMs,
    scripts
  };
}

function pcUrlFor(kvm: KvmConfigEntry): string {
  return hostAgentConfig(kvm)?.url || '';
}

function pcIpFromUrl(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0];
  }
}

function publicKvm(kvm: KvmConfigEntry): PublicKvm {
  const agent = hostAgentConfig(kvm);
  const endpoint = resolvedKvmEndpoint(kvm);
  const hostScripts = agent?.scripts.map((script) => ({
    id: script.id,
    label: script.label,
    description: script.description || ''
  })) || [];

  return {
    id: kvm.id,
    name: kvm.name,
    kvmEnabled: endpoint.enabled,
    ip: endpoint.enabled ? endpoint.ip : '',
    websiteUrl: endpoint.enabled ? baseUrl(kvm) : '',
    pcUrl: pcUrlFor(kvm),
    pcIp: pcIpFromUrl(pcUrlFor(kvm)),
    notes: kvm.notes || '',
    hasWolMac: endpoint.enabled && Boolean(endpoint.hostMacAddress),
    hasHostScript: hostScripts.length > 0,
    hostScriptLabel: hostScripts[0]?.label || 'Run Host Script',
    hostScripts
  };
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonRpcPayload(method: string, params: JsonRecord = {}): JsonRpcRequestPayload {
  // LuckFox/PicoKVM firmware is happier when params is always present.
  // This matches the curl command that was confirmed working:
  // { "jsonrpc": "2.0", "id": 1, "method": "triggerPower", "params": {} }
  return { jsonrpc: '2.0', id: Date.now(), method, params };
}

async function fetchWithTimeout(url: string, options: globalThis.RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getCookieHeader(kvm: KvmConfigEntry): string {
  return sessions.get(kvm.id)?.cookie || '';
}

function getSetCookieHeaders(headers: globalThis.Headers): string[] {
  const extendedHeaders = headers as globalThis.Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };

  const getSetCookieResult = extendedHeaders.getSetCookie?.();
  if (getSetCookieResult?.length) return getSetCookieResult;

  const rawSetCookie = extendedHeaders.raw?.()['set-cookie'];
  if (rawSetCookie?.length) return rawSetCookie;

  const singleHeader = headers.get('set-cookie');
  return singleHeader ? singleHeader.split(/,(?=[^;]+?=)/g) : [];
}

function setCookieHeader(kvm: KvmConfigEntry, response: globalThis.Response): void {
  const cookie = getSetCookieHeaders(response.headers)
    .map((chunk) => chunk.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  if (cookie) {
    sessions.set(kvm.id, { cookie, loggedInAt: new Date().toISOString() });
  }
}

async function login(kvm: KvmConfigEntry): Promise<JsonValue> {
  const response = await fetchWithTimeout(`${baseUrl(kvm)}/auth/login-local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ensureKvmEnabled(kvm).password })
  });
  if (response.status === 401) throw httpError('Login rejected by KVM', 401);
  if (!response.ok) throw httpError(`Login failed with HTTP ${response.status}`, response.status);
  setCookieHeader(kvm, response);
  return response.json().catch(() => ({ message: 'Login successful' }));
}

async function rpc<T extends JsonValue = JsonValue>(kvm: KvmConfigEntry, method: string, params: JsonRecord = {}, retry = true): Promise<T | null> {
  if (!getCookieHeader(kvm)) await login(kvm);
  const response = await fetchWithTimeout(`${baseUrl(kvm)}/api/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: getCookieHeader(kvm)
    },
    body: JSON.stringify(jsonRpcPayload(method, params))
  });

  if (response.status === 401 && retry) {
    sessions.delete(kvm.id);
    await login(kvm);
    return rpc<T>(kvm, method, params, false);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw httpError(`RPC ${method} failed with HTTP ${response.status}: ${text.slice(0, 200)}`, response.status);
  }

  const envelope = (await response.json()) as JsonRpcEnvelope<T>;
  if (envelope.error) {
    throw httpError(`RPC ${method} returned an error: ${envelope.error.message || 'Unknown JSON-RPC error'}`, 502, envelope.error);
  }
  return envelope.result ?? null;
}

async function keyboardReport(kvm: KvmConfigEntry, modifier: number, keys: number[]): Promise<JsonValue | null> {
  return rpc(kvm, 'keyboardReport', { modifier, keys });
}

async function keyPress(kvm: KvmConfigEntry, key: unknown): Promise<JsonValue | null> {
  const keycode = KEYNAME_TO_KEYCODE[String(key || '').toLowerCase()];
  if (!keycode) throw httpError(`Unknown key: ${key}`, 400);
  await keyboardReport(kvm, 0, [keycode]);
  return keyboardReport(kvm, 0, []);
}

async function keyCombo(kvm: KvmConfigEntry, combo: unknown): Promise<JsonValue | null> {
  const tokens = String(combo || '').split('+').map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) throw httpError('Combo cannot be empty', 400);
  let modifier = 0;
  for (const token of tokens.slice(0, -1)) {
    const bit = MODIFIER_BITS[token];
    if (!bit) throw httpError(`Unknown modifier: ${token}`, 400);
    modifier |= bit;
  }
  const last = tokens[tokens.length - 1];
  const keycode = KEYNAME_TO_KEYCODE[last];
  if (!keycode) throw httpError(`Unknown combo key: ${last}`, 400);
  await keyboardReport(kvm, modifier, [keycode]);
  return keyboardReport(kvm, 0, []);
}

async function typeText(kvm: KvmConfigEntry, text: unknown, delayMs = 5): Promise<JsonRecord> {
  const safeDelay = Math.max(0, Number(delayMs) || 0);
  const normalizedText = String(text || '');
  for (const ch of normalizedText) {
    const mapped = ASCII_TO_HID[ch];
    if (!mapped) throw httpError(`Unsupported character for US HID typing: ${JSON.stringify(ch)}`, 400);
    const [keycode, requiresShift] = mapped;
    await keyboardReport(kvm, requiresShift ? MODIFIER_BITS.shift : 0, [keycode]);
    await keyboardReport(kvm, 0, []);
    if (safeDelay > 0) await new Promise((resolve) => setTimeout(resolve, safeDelay));
  }
  return { typed: normalizedText.length };
}

function hostAgentUrl(kvm: KvmConfigEntry): string {
  const agent = hostAgentConfig(kvm);
  if (!agent) {
    throw httpError(`Host script agent is not configured for ${kvm.name}`, 400);
  }
  return agent.url;
}

function hostAgentHeaders(kvm: KvmConfigEntry, json = false): Record<string, string> {
  const agent = hostAgentConfig(kvm);
  const headers: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
  if (agent?.token) {
    headers.Authorization = `Bearer ${agent.token}`;
    headers['X-Agent-Token'] = agent.token;
  }
  return headers;
}

function findConfiguredHostScript(kvm: KvmConfigEntry, requestedScriptId?: unknown): NormalizedHostScript {
  const agent = hostAgentConfig(kvm);
  if (!agent) {
    throw httpError(`Host script agent is not configured for ${kvm.name}`, 400);
  }

  const scriptId = normalizeScriptId(requestedScriptId) || agent.scripts[0]?.id || DEFAULT_HOST_SCRIPT_ID;
  const script = agent.scripts.find((entry) => entry.id === scriptId);
  if (!script) {
    throw httpError(`Host script is not configured for ${kvm.name}: ${scriptId}`, 404);
  }
  return script;
}

async function runHostScript(kvm: KvmConfigEntry, payload: RequestBody = {}): Promise<JsonValue | null> {
  const agent = hostAgentConfig(kvm);
  if (!agent) {
    throw httpError(`Host script agent is not configured for ${kvm.name}`, 400);
  }

  const script = findConfiguredHostScript(kvm, payload.scriptId);
  const timeoutMs = Number(script.timeoutMs || agent.timeoutMs || 60000);

  const response = await fetchWithTimeout(`${hostAgentUrl(kvm)}/run`, {
    method: 'POST',
    headers: hostAgentHeaders(kvm, true),
    body: JSON.stringify({
      scriptId: script.id,
      scriptLabel: script.label,
      kvm: publicKvm(kvm),
      payload,
      timeoutSeconds: Math.ceil(timeoutMs / 1000)
    })
  }, timeoutMs + 2000);

  const text = await response.text().catch(() => '');
  let data: JsonValue | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as JsonValue;
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = isJsonRecord(data) && typeof data.detail === 'string'
      ? data.detail
      : `Host script agent failed with HTTP ${response.status}: ${text.slice(0, 200)}`;
    throw httpError(message, response.status, data);
  }

  if (isJsonRecord(data) && data.ok === false) {
    const stderr = typeof data.stderr === 'string' ? data.stderr.trim() : '';
    const exitCode = typeof data.exitCode === 'number' ? data.exitCode : 'unknown';
    throw httpError(`Host script ${script.label} exited with code ${exitCode}${stderr ? `: ${stderr.slice(0, 200)}` : ''}`, 502, data);
  }

  return data;
}

async function getPcReachability(kvm: KvmConfigEntry): Promise<{ responds: boolean; latencyMs: number | null; checkedAt: string; error: string }> {
  const checkedAt = new Date().toISOString();
  const agent = hostAgentConfig(kvm);
  if (!agent) {
    return { responds: false, latencyMs: null, checkedAt, error: 'Host agent is not configured' };
  }

  const started = Date.now();
  try {
    const response = await fetchWithTimeout(`${agent.url}/health`, { method: 'GET' }, Math.min(Number(agent.timeoutMs || 60000), 3000));
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      return { responds: false, latencyMs, checkedAt, error: `Host agent health returned HTTP ${response.status}` };
    }
    return { responds: true, latencyMs, checkedAt, error: '' };
  } catch (error) {
    return {
      responds: false,
      latencyMs: Date.now() - started,
      checkedAt,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function getHostStats(kvm: KvmConfigEntry): Promise<HostStats | null> {
  if (!hostAgentConfig(kvm)) return null;

  const response = await fetchWithTimeout(`${hostAgentUrl(kvm)}/stats`, {
    method: 'GET',
    headers: hostAgentHeaders(kvm)
  }, Math.min(Number(hostAgentConfig(kvm)?.timeoutMs || 60000), 10000));

  const text = await response.text().catch(() => '');
  let data: HostStats | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as HostStats;
    } catch {
      data = { ok: false, error: text.slice(0, 200) };
    }
  }

  if (!response.ok) {
    const detail = data && typeof data.error === 'string' ? data.error : text.slice(0, 200);
    throw httpError(`Host stats agent failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`, response.status, data);
  }

  return data;
}

async function getStatus(kvm: KvmConfigEntry): Promise<KvmStatus> {
  const started = Date.now();
  const status: KvmStatus = {
    ...publicKvm(kvm),
    kvmResponds: false,
    authenticated: false,
    pcResponds: false,
    pcLatencyMs: null,
    pcCheckedAt: new Date().toISOString(),
    pcError: '',
    deviceId: '',
    video: null,
    usb: undefined,
    keyboardLeds: undefined,
    hostPower: 'unknown',
    hostStats: null,
    hostStatsError: '',
    latencyMs: null,
    checkedAt: new Date().toISOString(),
    error: ''
  };

  const pcReachabilityPromise = getPcReachability(kvm);
  const hostStatsPromise = getHostStats(kvm)
    .then((stats) => ({ stats, error: '' }))
    .catch((error: unknown) => ({ stats: null, error: error instanceof Error ? error.message : String(error) }));

  if (resolvedKvmEndpoint(kvm).enabled) {
    try {
      await login(kvm);
      status.authenticated = true;
      const [ping, deviceId, video, usb, keyboardLeds] = await Promise.allSettled([
        rpc<string>(kvm, 'ping'),
        rpc<string>(kvm, 'getDeviceID'),
        rpc<VideoState>(kvm, 'getVideoState'),
        rpc<JsonValue>(kvm, 'getUSBState'),
        rpc<JsonValue>(kvm, 'getKeyboardLedState')
      ]);

      status.kvmResponds = ping.status === 'fulfilled' && ping.value === 'pong';
      status.deviceId = deviceId.status === 'fulfilled' && typeof deviceId.value === 'string' ? deviceId.value : '';
      status.video = video.status === 'fulfilled' ? video.value : null;
      status.usb = usb.status === 'fulfilled' ? usb.value ?? undefined : undefined;
      status.keyboardLeds = keyboardLeds.status === 'fulfilled' ? keyboardLeds.value ?? undefined : undefined;
      status.hostPower = status.video?.ready ? 'on / HDMI signal' : `unknown${status.video?.error ? ` (${status.video.error})` : ''}`;
      status.latencyMs = Date.now() - started;
    } catch (error) {
      status.error = error instanceof Error ? error.message : String(error);
      status.latencyMs = Date.now() - started;
    }
  } else {
    status.hostPower = 'no KVM configured';
    status.latencyMs = null;
  }

  const pcReachability = await pcReachabilityPromise;
  status.pcResponds = pcReachability.responds;
  status.pcLatencyMs = pcReachability.latencyMs;
  status.pcCheckedAt = pcReachability.checkedAt;
  status.pcError = pcReachability.error;

  const hostStatsResult = await hostStatsPromise;
  status.hostStats = hostStatsResult.stats;
  status.hostStatsError = hostStatsResult.error;

  return status;
}

async function runAction(kvm: KvmConfigEntry, action: string, body: RequestBody = {}): Promise<JsonValue | null> {
  switch (action) {
    case 'power':
      return rpc(kvm, 'triggerPower');
    case 'reset':
      return rpc(kvm, 'triggerReset');
    case 'usbWakeup':
      return rpc(kvm, 'sendUsbWakeupSignal');
    case 'wol': {
      const macAddress = String(body.macAddress || ensureKvmEnabled(kvm).hostMacAddress || '');
      if (!macAddress) throw httpError('macAddress is required for Wake-on-LAN', 400);
      return rpc(kvm, 'sendWOLMagicPacket', { macAddress });
    }
    case 'arrowUp':
      return keyPress(kvm, 'ArrowUp');
    case 'hostScript':
      return runHostScript(kvm, body);
    case 'keyPress':
      return keyPress(kvm, body.key);
    case 'keyCombo':
      return keyCombo(kvm, body.combo);
    case 'ctrlAltDel':
      return keyCombo(kvm, 'Ctrl+Alt+Delete');
    case 'typeText':
      return typeText(kvm, body.text, Number(body.delayMs ?? 5));
    case 'keyboardReport':
      return keyboardReport(kvm, Number(body.modifier || 0), Array.isArray(body.keys) ? body.keys.map(Number) : []);
    case 'absMouseReport':
      return rpc(kvm, 'absMouseReport', {
        x: Number(body.x || 0),
        y: Number(body.y || 0),
        buttons: Number(body.buttons || 0)
      });
    case 'relMouseReport':
      return rpc(kvm, 'relMouseReport', {
        dx: Number(body.dx || 0),
        dy: Number(body.dy || 0),
        buttons: Number(body.buttons || 0)
      });
    case 'wheelReport':
      return rpc(kvm, 'wheelReport', { wheelY: Number(body.wheelY || body.wheel || 0) });
    case 'click': {
      const button = String(body.button || 'left').toLowerCase();
      const buttons = MOUSE_BUTTON_BITS[button];
      if (!buttons) throw httpError(`Unknown mouse button: ${button}`, 400);
      const x = Number(body.x || 0);
      const y = Number(body.y || 0);
      await rpc(kvm, 'absMouseReport', { x, y, buttons: 0 });
      await rpc(kvm, 'absMouseReport', { x, y, buttons });
      return rpc(kvm, 'absMouseReport', { x, y, buttons: 0 });
    }
    case 'mountWithHTTP':
      return rpc(kvm, 'mountWithHTTP', { url: String(body.url || ''), mode: String(body.mode || 'CDROM') });
    case 'mountWithStorage':
      return rpc(kvm, 'mountWithStorage', { filename: String(body.filename || ''), mode: String(body.mode || 'CDROM') });
    case 'mountBuiltInImage':
      return rpc(kvm, 'mountBuiltInImage', { filename: String(body.filename || '') });
    case 'unmountImage':
      return rpc(kvm, 'unmountImage');
    case 'rebootKvm':
      return rpc(kvm, 'reboot', { force: Boolean(body.force) });
    default:
      throw httpError(`Unknown action: ${action}`, 404);
  }
}

function asyncHandler(handler: (req: Request, res: ExpressResponse, next: NextFunction) => Promise<void>): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'luckfox-kvm-matrix', host: HOST, port: PORT, kvms: config.kvms.length });
});

app.get('/api/kvms', (_req, res) => {
  res.json({ kvms: config.kvms.map(publicKvm), pollIntervalMs: config.server?.pollIntervalMs || 15000 });
});

app.get('/api/actions', (_req, res) => {
  res.json({ actions: ACTIONS });
});

app.get('/api/kvms/status', asyncHandler(async (_req, res) => {
  const results = await Promise.all(config.kvms.map((kvm) => getStatus(kvm)));
  res.json({ kvms: results });
}));

app.get('/api/kvms/:id/status', asyncHandler(async (req, res) => {
  const kvm = findKvm(routeParam(req.params.id, 'id'));
  res.json(await getStatus(kvm));
}));

app.get('/api/kvms/:id/host-stats', asyncHandler(async (req, res) => {
  const kvm = findKvm(routeParam(req.params.id, 'id'));
  res.json({ ok: true, stats: await getHostStats(kvm) });
}));

app.get('/api/kvms/:id/pc-status', asyncHandler(async (req, res) => {
  const kvm = findKvm(routeParam(req.params.id, 'id'));
  res.json({ ok: true, pc: await getPcReachability(kvm) });
}));

app.post('/api/kvms/:id/login', asyncHandler(async (req, res) => {
  const kvm = findKvm(routeParam(req.params.id, 'id'));
  res.json(await login(kvm));
}));

app.post('/api/kvms/:id/action/:action', asyncHandler(async (req, res) => {
  const kvm = findKvm(routeParam(req.params.id, 'id'));
  const result = await runAction(kvm, routeParam(req.params.action, 'action'), (req.body || {}) as RequestBody);
  res.json({ ok: true, result });
}));

app.post('/api/kvms/:id/rpc', asyncHandler(async (req, res) => {
  const kvm = findKvm(routeParam(req.params.id, 'id'));
  const body = (req.body || {}) as RequestBody;
  const method = body.method;
  const params = body.params;
  if (!method || typeof method !== 'string') throw httpError('method is required', 400);
  const result = await rpc(kvm, method, isJsonRecord(params) ? params : {});
  res.json({ ok: true, result });
}));

const distPath = path.join(ROOT, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.use((err: ApiError, _req: Request, res: ExpressResponse, _next: NextFunction) => {
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: err.message || 'Server error',
    data: err.data || undefined
  });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    const shownHost = HOST === '0.0.0.0' || HOST === '::' ? '<this-machine-ip>' : HOST;
    console.log(`LuckFox KVM dashboard listening on http://${shownHost}:${PORT}`);
  });
}
