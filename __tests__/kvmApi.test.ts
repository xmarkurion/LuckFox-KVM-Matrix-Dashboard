import { fetchKvms, runKvmAction, runRawRpc } from '../src/services/kvmApi';

function mockJsonResponse(body: unknown, init: Partial<Response> = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(body)
  } as Response;
}

describe('kvmApi service', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('fetchKvms returns parsed KVM list', async () => {
    jest.mocked(fetch).mockResolvedValue(mockJsonResponse({ kvms: [{ id: 'am4' }], pollIntervalMs: 15000 }));

    await expect(fetchKvms()).resolves.toEqual({ kvms: [{ id: 'am4' }], pollIntervalMs: 15000 });
    expect(fetch).toHaveBeenCalledWith('/api/kvms');
  });

  test('runKvmAction posts action payload', async () => {
    jest.mocked(fetch).mockResolvedValue(mockJsonResponse({ ok: true, result: null }));

    await runKvmAction('am4', 'power', { confirm: true });

    expect(fetch).toHaveBeenCalledWith('/api/kvms/am4/action/power', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true })
    });
  });

  test('runRawRpc posts JSON-RPC method and params', async () => {
    jest.mocked(fetch).mockResolvedValue(mockJsonResponse({ ok: true, result: { ready: true } }));

    await runRawRpc('pcmain', 'getVideoState', {});

    expect(fetch).toHaveBeenCalledWith('/api/kvms/pcmain/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'getVideoState', params: {} })
    });
  });

  test('throws a useful error for backend failures', async () => {
    jest.mocked(fetch).mockResolvedValue(mockJsonResponse({ ok: false, error: 'boom' }, { ok: false, status: 500 }));

    await expect(runKvmAction('am4', 'power')).rejects.toThrow('boom');
  });
});
