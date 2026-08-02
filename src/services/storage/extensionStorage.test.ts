import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from './extensionStorage';
import {
  STORAGE_SCHEMA_VERSION,
  STORAGE_SETTINGS_KEY,
  STORAGE_QUOTE_CACHE_KEY,
  ExtensionStorageController,
  createDefaultQuoteCache,
  createDefaultSnapshot,
  createMemoryStorageAdapter,
  validateImportedSettings,
} from './extensionStorage';

function createController(initial?: Record<string, unknown>): {
  adapter: ReturnType<typeof createMemoryStorageAdapter>;
  controller: ExtensionStorageController;
} {
  const adapter = createMemoryStorageAdapter(initial);
  const controller = new ExtensionStorageController(adapter);
  return { adapter, controller };
}

describe('extension storage', () => {
  it('loads defaults when storage is empty', async () => {
    const { controller } = createController();

    await controller.ready();

    expect(controller.getSnapshot()).toEqual(createDefaultSnapshot());
  });

  it('normalizes partial stored settings', async () => {
    const { controller } = createController({
      [STORAGE_SETTINGS_KEY]: {
        settings: {
          enabledMarketIds: ['nse'],
          marketOrder: ['nse'],
          appearance: {
            density: 'compact',
          },
          dataProvider: {
            providerId: 'twelvedata',
            apiKey: 'abc123',
          },
        },
      },
    });

    await controller.ready();

    const snapshot = controller.getSnapshot();
    expect(snapshot.settingsSchemaVersion).toBe(STORAGE_SCHEMA_VERSION);
    expect(snapshot.settings.enabledMarketIds).toEqual(['nse']);
    expect(snapshot.settings.marketOrder).toEqual(['nse']);
    expect(snapshot.settings.appearance.density).toBe('compact');
    expect(snapshot.settings.appearance.clockFormat).toBe('24h');
    expect(snapshot.settings.appearance.showSearch).toBe(true);
    expect(snapshot.settings.appearance.showQuickLinks).toBe(true);
    expect(snapshot.settings.dataProvider.apiKey).toBe('abc123');
  });

  it('recovers safely from invalid stored data', async () => {
    const { controller } = createController({
      [STORAGE_SETTINGS_KEY]: {
        settings: {
          enabledMarketIds: ['unknown-market'],
          marketOrder: ['unknown-market'],
          appearance: null,
          dataProvider: 'invalid',
        },
      },
      [STORAGE_QUOTE_CACHE_KEY]: {
        quotes: [
          {
            marketId: 'nse',
            quote: {
              marketId: 'nse',
              symbol: 'NSE:NIFTY',
              indexName: 'NIFTY 50',
              value: 'invalid',
              previousClose: null,
              absoluteChange: null,
              percentageChange: null,
              currency: null,
              asOf: null,
              dataState: 'mock',
              provider: 'demo',
            },
            fetchedAt: 'invalid',
          },
        ],
        lastSuccessfulRefreshAt: 1234,
      },
    });

    await controller.ready();

    const snapshot = controller.getSnapshot();
    expect(snapshot.settings.enabledMarketIds).toEqual([]);
    expect(snapshot.settings.marketOrder).toEqual([]);
    expect(snapshot.settings.appearance).toEqual(createDefaultSettings().appearance);
    expect(snapshot.settings.dataProvider).toEqual(createDefaultSettings().dataProvider);
    expect(snapshot.settings.quickLinks).toEqual(createDefaultSettings().quickLinks);
    expect(controller.getSnapshot().quoteCache).toEqual(createDefaultQuoteCache());
  });

  it('migrates legacy settings envelopes to the current schema', async () => {
    const { controller } = createController({
      [STORAGE_SETTINGS_KEY]: {
        schemaVersion: 0,
        settings: {
          enabledMarketIds: ['nse', 'lse'],
          marketOrder: ['lse', 'nse'],
          quickLinks: [],
          appearance: {
            density: 'comfortable',
            clockFormat: '12h',
            showSearch: false,
            showQuickLinks: true,
          },
          dataProvider: {
            providerId: 'mock',
            apiKey: null,
          },
        },
      },
    });

    await controller.ready();

    const snapshot = controller.getSnapshot();
    expect(snapshot.settingsSchemaVersion).toBe(STORAGE_SCHEMA_VERSION);
    expect(snapshot.settings.enabledMarketIds).toEqual(['nse', 'lse']);
    expect(snapshot.settings.marketOrder).toEqual(['lse', 'nse']);
  });

  it('validates imported settings before applying them', async () => {
    const { controller } = createController();
    await controller.ready();

    const invalid = await validateImportedSettings({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      settings: {
        enabledMarketIds: ['nse', 'invalid-market'],
        marketOrder: ['nse', 'invalid-market'],
        quickLinks: [],
        providerSymbolOverrides: {},
        appearance: {
          density: 'compact',
          clockFormat: '24h',
          showSearch: true,
          showQuickLinks: true,
        },
        dataProvider: {
          providerId: 'twelvedata',
          apiKey: null,
        },
      },
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((error) => error.path === 'enabledMarketIds')).toBe(true);

    const result = await controller.importSettingsJson(
      JSON.stringify({
        schemaVersion: STORAGE_SCHEMA_VERSION,
        settings: {
          enabledMarketIds: ['nse'],
          marketOrder: ['nse'],
          quickLinks: [],
          providerSymbolOverrides: {},
          appearance: {
            density: 'compact',
            clockFormat: '24h',
            showSearch: false,
            showQuickLinks: false,
          },
          dataProvider: {
            providerId: 'mock',
            apiKey: null,
          },
        },
      }),
    );

    expect(result.valid).toBe(true);
    expect(controller.getSnapshot().settings.enabledMarketIds).toEqual(['nse']);
    expect(controller.getSnapshot().settings.appearance.showSearch).toBe(false);
  });

  it('supports reset operations without clearing unrelated data', async () => {
    const { adapter, controller } = createController();
    await controller.ready();

    await controller.setQuoteCache({
      quotes: [
        {
          marketId: 'nse',
          fetchedAt: '2026-08-02T10:00:00.000Z',
          providerTimestamp: '2026-08-02T09:59:00.000Z',
          expiresAt: '2026-08-02T10:15:00.000Z',
          providerId: 'demo',
          quote: {
            marketId: 'nse',
            symbol: 'NSE:NIFTY',
            indexName: 'NIFTY 50',
            value: 25000,
            previousClose: 24900,
            absoluteChange: 100,
            percentageChange: 0.4,
            currency: 'INR',
            asOf: '2026-08-02T09:59:00.000Z',
            dataState: 'cached',
            provider: 'demo',
          },
        },
      ],
      lastSuccessfulRefreshAt: '2026-08-02T10:00:00.000Z',
    });

    await controller.updateSettings({
      enabledMarketIds: ['nse'],
      marketOrder: ['nse'],
      appearance: {
        density: 'compact',
        clockFormat: '12h',
        showSearch: false,
        showQuickLinks: false,
      },
      dataProvider: {
        providerId: 'mock',
        apiKey: 'secret',
      },
    });

    await controller.clearQuoteCache();
    expect(controller.getSnapshot().quoteCache).toEqual(createDefaultQuoteCache());

    await controller.resetPreferences();
    expect(controller.getSnapshot().settings).toEqual(createDefaultSettings());
    expect(controller.getSnapshot().quoteCache).toEqual(createDefaultQuoteCache());

    await controller.clearAllExtensionData();
    expect(controller.getSnapshot()).toEqual(createDefaultSnapshot());
    expect(adapter.snapshot()).toEqual({});
  });

  it('does not export the API key unless requested', async () => {
    const { controller } = createController();
    await controller.ready();

    await controller.updateSettings({
      dataProvider: {
        providerId: 'twelvedata',
        apiKey: 'secret-key',
      },
    });

    expect(controller.exportSettings()).toContain('"apiKey": null');
    expect(controller.exportSettings(true)).toContain('secret-key');
  });
});
