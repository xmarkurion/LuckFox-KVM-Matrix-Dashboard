import { mount } from '@vue/test-utils';
import KvmCard from '../src/components/KvmCard.vue';
import type { KvmStatus, KvmSummary } from '../src/types/kvm';

const kvm: KvmSummary = {
  id: 'am4',
  name: 'AM4',
  ip: '192.168.10.92',
  notes: 'AM4 workstation',
  websiteUrl: 'http://192.168.10.92',
  hasWolMac: false
};

const status: KvmStatus = {
  ...kvm,
  kvmResponds: true,
  authenticated: true,
  hostPower: 'on / HDMI signal',
  video: { ready: true, width: 1920, height: 1080, fps: 60 },
  usb: 'configured',
  keyboardLeds: undefined,
  deviceId: '',
  latencyMs: 22,
  checkedAt: new Date().toISOString(),
  error: ''
};

describe('KvmCard', () => {
  test('renders KVM identity and status', () => {
    const wrapper = mount(KvmCard, { props: { kvm, status, busy: '' } });

    expect(wrapper.text()).toContain('AM4');
    expect(wrapper.text()).toContain('192.168.10.92');
    expect(wrapper.text()).toContain('online');
    expect(wrapper.text()).toContain('1920×1080');
  });

  test('emits power action', async () => {
    const wrapper = mount(KvmCard, { props: { kvm, status, busy: '' } });
    const powerButton = wrapper.findAll('button').find((button) => button.text().includes('Power'));

    await powerButton?.trigger('click');

    expect(wrapper.emitted('action')?.[0][0]).toEqual({ id: 'am4', action: 'power', payload: {} });
  });
});
