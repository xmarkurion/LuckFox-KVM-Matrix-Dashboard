import { mount } from '@vue/test-utils';
import KvmCard from '../src/components/KvmCard.vue';
import type { KvmStatus, KvmSummary } from '../src/types/kvm';

const kvm: KvmSummary = {
  id: 'am4',
  name: 'AM4',
  kvmEnabled: true,
  ip: '192.168.10.92',
  notes: 'AM4 workstation',
  websiteUrl: 'http://192.168.10.92',
  pcUrl: 'http://192.168.10.92:8799',
  pcIp: '192.168.10.92',
  hasWolMac: false,
  hasHostScript: true,
  hostScriptLabel: 'Run AM4 Script',
  hostScripts: [
    { id: 'host_action', label: 'Run AM4 Script', description: 'Default editable host action script.' },
    { id: 'script2', label: 'AM4 Example Script 2', description: 'Example second script.' }
  ]
};

const status: KvmStatus = {
  ...kvm,
  kvmResponds: true,
  authenticated: true,
  pcResponds: true,
  pcLatencyMs: 18,
  pcCheckedAt: new Date().toISOString(),
  pcError: '',
  hostPower: 'on / HDMI signal',
  video: { ready: true, width: 1920, height: 1080, fps: 60 },
  usb: 'configured',
  keyboardLeds: undefined,
  hostStats: {
    ok: true,
    hostname: 'am4-host',
    collectedAt: new Date().toISOString(),
    uptimeSeconds: 3661,
    platform: { osName: 'Linux test host', system: 'Linux', release: '6.8', machine: 'x86_64' },
    docker: { containerized: true, hostProcMounted: true, hostRootMounted: true },
    cpu: { percent: 12.5, countLogical: 16, countPhysical: 8, loadAverage: [0.1, 0.2, 0.3] },
    memory: { totalBytes: 17179869184, usedBytes: 8589934592, freeBytes: 8589934592, availableBytes: 8589934592, percent: 50 },
    swap: { totalBytes: 2147483648, usedBytes: 0, freeBytes: 2147483648, percent: 0 },
    disks: [{ device: 'host-root', mountpoint: '/host/root', path: '/host/root', fstype: 'host', totalBytes: 107374182400, usedBytes: 53687091200, freeBytes: 53687091200, percent: 50 }]
  },
  hostStatsError: '',
  deviceId: '',
  latencyMs: 22,
  checkedAt: new Date().toISOString(),
  error: ''
};

describe('KvmCard', () => {
  test('renders KVM identity and status', () => {
    const wrapper = mount(KvmCard, { props: { kvm, status, busy: '' } });

    expect(wrapper.text()).toContain('AM4');
    expect(wrapper.text()).toContain('KVM IP:');
    expect(wrapper.text()).toContain('192.168.10.92');
    expect(wrapper.text()).toContain('PC IP:');
    expect(wrapper.text()).toContain('192.168.10.92');
    expect(wrapper.text()).not.toContain('http://192.168.10.92:8799');
    expect(wrapper.text()).toContain('KVM online');
    expect(wrapper.text()).toContain('PC online');
    expect(wrapper.text()).toContain('1920×1080');
    expect(wrapper.text()).toContain('am4-host');
    expect(wrapper.text()).toContain('CPU');
    expect(wrapper.text()).toContain('12.5%');
    expect(wrapper.text()).toContain('Scripts');
    expect(wrapper.text()).toContain('AM4 Example Script 2');
  });



  test('renders host-agent-only devices without KVM controls', () => {
    const agentOnlyKvm: KvmSummary = {
      ...kvm,
      id: 'scriptbox',
      name: 'ScriptBox',
      kvmEnabled: false,
      ip: '',
      websiteUrl: '',
      pcUrl: 'http://192.168.10.150:8799',
      pcIp: '192.168.10.150'
    };
    const agentOnlyStatus: KvmStatus = {
      ...status,
      ...agentOnlyKvm,
      kvmResponds: false,
      authenticated: false,
      hostPower: 'no KVM configured',
      video: null,
      usb: undefined,
      latencyMs: null
    };

    const wrapper = mount(KvmCard, { props: { kvm: agentOnlyKvm, status: agentOnlyStatus, busy: '' } });

    expect(wrapper.text()).toContain('ScriptBox');
    expect(wrapper.text()).not.toContain('Host-agent only');
    expect(wrapper.text()).toContain('PC IP:');
    expect(wrapper.text()).toContain('192.168.10.150');
    expect(wrapper.text()).toContain('PC online');
    expect(wrapper.text()).toContain('AM4 Example Script 2');
    expect(wrapper.text()).not.toContain('KVM IP:');
    expect(wrapper.text()).not.toContain('Open KVM');
    expect(wrapper.text()).not.toContain('Power LED:');
    expect(wrapper.text()).not.toContain('More API controls');
  });

  test('emits power action', async () => {
    const wrapper = mount(KvmCard, { props: { kvm, status, busy: '' } });
    const powerButton = wrapper.findAll('button').find((button) => button.text().includes('Power'));

    await powerButton?.trigger('click');

    expect(wrapper.emitted('action')?.[0][0]).toEqual({ id: 'am4', action: 'power', payload: {} });
  });

  test('emits selected host script action', async () => {
    const wrapper = mount(KvmCard, { props: { kvm, status, busy: '' } });
    const scriptButton = wrapper.findAll('button').find((button) => button.text().includes('AM4 Example Script 2'));

    await scriptButton?.trigger('click');

    expect(wrapper.emitted('action')?.[0][0]).toEqual({
      id: 'am4',
      action: 'hostScript',
      payload: { scriptId: 'script2', scriptLabel: 'AM4 Example Script 2' }
    });
  });
});
