import {
  createConfigBackup,
  deleteConfigBackup,
  fetchDashboardConfig,
  restoreConfigBackup,
  saveDashboardConfig
} from '../src/services/configApi';

function mockJsonResponse(body: unknown, init: Partial<Response> = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(body)
  } as Response;
}

describe('config API service', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('loads the complete dashboard configuration without caching', async () => {
    const body = { ok: true, config: { kvms: [] }, configPath: '/app/kvm.config.json', backupPath: '/app/backups', writable: true, maxBackups: 10, restartRequiredFields: [] };
    jest.mocked(fetch).mockResolvedValue(mockJsonResponse(body));

    await expect(fetchDashboardConfig()).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith('/api/config', { cache: 'no-store' });
  });

  test('saves the full configuration', async () => {
    jest.mocked(fetch).mockResolvedValue(mockJsonResponse({ ok: true, backups: [] }));
    const config = { kvms: [{ id: 'lmde', name: 'LMDE' }] };

    await saveDashboardConfig(config);

    expect(fetch).toHaveBeenCalledWith('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config })
    });
  });

  test('creates, restores and deletes backups through encoded routes', async () => {
    jest.mocked(fetch).mockResolvedValue(mockJsonResponse({ ok: true, backups: [] }));
    const name = 'kvm.config.2026-01-01.manual.json';

    await createConfigBackup();
    await restoreConfigBackup(name);
    await deleteConfigBackup(name);

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/config/backups', { method: 'POST' });
    expect(fetch).toHaveBeenNthCalledWith(2, `/api/config/backups/${encodeURIComponent(name)}/restore`, { method: 'POST' });
    expect(fetch).toHaveBeenNthCalledWith(3, `/api/config/backups/${encodeURIComponent(name)}`, { method: 'DELETE' });
  });
});
