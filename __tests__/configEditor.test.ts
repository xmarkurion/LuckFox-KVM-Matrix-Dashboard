import {
  createDefaultNode,
  ensureHostAgentConfig,
  ensureKvmConfig,
  normalizeEditableConfig
} from '../src/services/configEditor';

describe('config editor helpers', () => {
  test('creates an agent-ready node with optional KVM disabled', () => {
    const node = createDefaultNode(5);
    expect(node.id).toBe('node-5');
    expect(ensureKvmConfig(node).enabled).toBe(false);
    expect(ensureHostAgentConfig(node).scripts).toEqual([]);
  });

  test('normalizes server defaults without losing device data', () => {
    const config = normalizeEditableConfig({
      kvms: [{ id: 'nas', name: 'NAS', notes: 'storage', kvm: false }]
    });

    expect(config.server).toMatchObject({ host: '0.0.0.0', port: 8787, pollIntervalMs: 15000 });
    expect(config.kvms[0]).toMatchObject({ id: 'nas', name: 'NAS', notes: 'storage' });
    expect(ensureKvmConfig(config.kvms[0]).enabled).toBe(false);
  });
});
