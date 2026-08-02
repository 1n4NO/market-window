import { useMemo, useState } from 'react';
import { MARKET_DEFINITIONS } from '../../config/markets';
import type { QuickLink, UserSettings } from '../../domain/market';
import {
  clearAllExtensionData,
  clearQuoteCache,
  exportSettingsToJson,
  resetPreferences,
} from '../../services/storage/extensionStorage';
import { useExtensionStorage } from '../../hooks/useExtensionStorage';

const providerOptions = ['twelvedata', 'mock'] as const;

function createQuickLinksJson(quickLinks: QuickLink[]): string {
  return JSON.stringify(quickLinks, null, 2);
}

function sortEnabledMarkets(settings: UserSettings): string[] {
  const enabled = new Set(settings.enabledMarketIds);
  const order = new Map(settings.marketOrder.map((marketId, index) => [marketId, index]));
  return MARKET_DEFINITIONS.filter((market) => enabled.has(market.id)).sort(
    (left, right) => (order.get(left.id) ?? Number.POSITIVE_INFINITY) - (order.get(right.id) ?? Number.POSITIVE_INFINITY),
  ).map((market) => market.id);
}

function reorderMarket(settings: UserSettings, marketId: string, direction: -1 | 1): UserSettings {
  const nextOrder = [...settings.marketOrder];
  const currentIndex = nextOrder.indexOf(marketId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= nextOrder.length) {
    return settings;
  }

  [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
  return {
    ...settings,
    marketOrder: nextOrder,
  };
}

export function DeveloperSettingsPanel() {
  const { controller, snapshot } = useExtensionStorage();
  const [quickLinksText, setQuickLinksText] = useState(() => createQuickLinksJson(snapshot.settings.quickLinks));
  const [providerOverridesText, setProviderOverridesText] = useState(() =>
    JSON.stringify(snapshot.settings.providerSymbolOverrides, null, 2),
  );
  const [jsonText, setJsonText] = useState('');
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const enabledMarketIds = useMemo(() => sortEnabledMarkets(snapshot.settings), [snapshot.settings]);

  function updateStatus(message: string): void {
    setStatus(message);
  }

  async function saveSettings(nextSettings: UserSettings): Promise<void> {
    await controller.setSettings(nextSettings);
    updateStatus('Settings saved.');
  }

  async function toggleMarket(marketId: string, enabled: boolean): Promise<void> {
    const nextEnabled = enabled
      ? Array.from(new Set([...snapshot.settings.enabledMarketIds, marketId]))
      : snapshot.settings.enabledMarketIds.filter((id) => id !== marketId);
    const nextOrder = snapshot.settings.marketOrder.filter((id) => nextEnabled.includes(id));
    for (const id of nextEnabled) {
      if (!nextOrder.includes(id)) {
        nextOrder.push(id);
      }
    }

    await saveSettings({
      ...snapshot.settings,
      enabledMarketIds: nextEnabled,
      marketOrder: nextOrder,
    });
  }

  async function applyAppearancePatch(patch: Partial<UserSettings['appearance']>): Promise<void> {
    await saveSettings({
      ...snapshot.settings,
      appearance: {
        ...snapshot.settings.appearance,
        ...patch,
      },
    });
  }

  async function applyProviderPatch(patch: Partial<UserSettings['dataProvider']>): Promise<void> {
    await saveSettings({
      ...snapshot.settings,
      dataProvider: {
        ...snapshot.settings.dataProvider,
        ...patch,
      },
    });
  }

  async function saveProviderOverridesFromJson(): Promise<void> {
    try {
      const parsed = JSON.parse(providerOverridesText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Provider overrides JSON must be an object.');
      }
      await saveSettings({
        ...snapshot.settings,
        providerSymbolOverrides: parsed as UserSettings['providerSymbolOverrides'],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid provider overrides JSON.';
      updateStatus(message);
    }
  }

  async function saveQuickLinksFromJson(): Promise<void> {
    try {
      const parsed = JSON.parse(quickLinksText);
      if (!Array.isArray(parsed)) {
        throw new Error('Quick links JSON must be an array.');
      }
      await saveSettings({
        ...snapshot.settings,
        quickLinks: parsed as QuickLink[],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid quick links JSON.';
      updateStatus(message);
    }
  }

  async function moveMarket(marketId: string, direction: -1 | 1): Promise<void> {
    await saveSettings(reorderMarket(snapshot.settings, marketId, direction));
  }

  async function exportSettings(): Promise<void> {
    const json = exportSettingsToJson(includeSecrets);
    setJsonText(json);
    updateStatus(includeSecrets ? 'Exported settings with secrets.' : 'Exported settings without secrets.');
  }

  async function importSettings(): Promise<void> {
    const result = await controller.importSettingsJson(jsonText);
    if (!result.valid) {
      updateStatus(result.errors.map((error) => `${error.path || 'settings'}: ${error.message}`).join(' '));
      return;
    }
    updateStatus('Imported settings successfully.');
  }

  async function handleResetPreferences(): Promise<void> {
    await resetPreferences();
    updateStatus('Preferences reset to defaults.');
  }

  async function handleClearQuoteCache(): Promise<void> {
    await clearQuoteCache();
    updateStatus('Quote cache cleared.');
  }

  async function handleClearAllData(): Promise<void> {
    await clearAllExtensionData();
    updateStatus('All extension data cleared.');
  }

  return (
    <section className="rounded-[1.75rem] border border-line bg-surface/70 p-5 shadow-glow">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Developer settings</p>
        <h2 className="text-2xl font-semibold tracking-tight">Persistence test bench</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted">
          These controls exercise the phase 4 storage wrapper, migrations, and import/export flow.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-line/80 bg-bg/50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Markets</h3>
          <div className="mt-4 space-y-3">
            {MARKET_DEFINITIONS.map((market) => {
              const enabled = snapshot.settings.enabledMarketIds.includes(market.id);
              const index = enabledMarketIds.indexOf(market.id);
              return (
                <div key={market.id} className="flex flex-col gap-2 rounded-xl border border-line/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-3">
                    <input
                      checked={enabled}
                      className="h-4 w-4 rounded border-line bg-transparent text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      onChange={(event) => {
                        void toggleMarket(market.id, event.target.checked);
                      }}
                      type="checkbox"
                    />
                    <span>
                      <span className="block font-medium">{market.exchangeCode}</span>
                      <span className="block text-xs text-muted">{market.country}</span>
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-text disabled:opacity-30"
                      disabled={!enabled || index <= 0}
                      onClick={() => {
                        void moveMarket(market.id, -1);
                      }}
                      type="button"
                    >
                      Up
                    </button>
                    <button
                      className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-text disabled:opacity-30"
                      disabled={!enabled || index < 0 || index >= enabledMarketIds.length - 1}
                      onClick={() => {
                        void moveMarket(market.id, 1);
                      }}
                      type="button"
                    >
                      Down
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-line/80 bg-bg/50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Appearance</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-muted">Density</span>
              <select
                className="rounded-xl border border-line bg-bg px-3 py-2 text-text outline-none focus-visible:border-accent"
                value={snapshot.settings.appearance.density}
                onChange={(event) => {
                  void applyAppearancePatch({
                    density: event.target.value === 'compact' ? 'compact' : 'comfortable',
                  });
                }}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-muted">Clock format</span>
              <select
                className="rounded-xl border border-line bg-bg px-3 py-2 text-text outline-none focus-visible:border-accent"
                value={snapshot.settings.appearance.clockFormat}
                onChange={(event) => {
                  void applyAppearancePatch({
                    clockFormat: event.target.value === '12h' ? '12h' : '24h',
                  });
                }}
              >
                <option value="24h">24-hour</option>
                <option value="12h">12-hour</option>
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2 text-sm">
              <input
                checked={snapshot.settings.appearance.showSearch}
                className="h-4 w-4 rounded border-line bg-transparent text-accent"
                onChange={(event) => {
                  void applyAppearancePatch({ showSearch: event.target.checked });
                }}
                type="checkbox"
              />
              <span>Show search</span>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2 text-sm">
              <input
                checked={snapshot.settings.appearance.showQuickLinks}
                className="h-4 w-4 rounded border-line bg-transparent text-accent"
                onChange={(event) => {
                  void applyAppearancePatch({ showQuickLinks: event.target.checked });
                }}
                type="checkbox"
              />
              <span>Show quick links</span>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-line/80 bg-bg/50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Data provider</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-muted">Provider id</span>
              <input
                list="provider-options"
                className="rounded-xl border border-line bg-bg px-3 py-2 text-text outline-none focus-visible:border-accent"
                value={snapshot.settings.dataProvider.providerId}
                onChange={(event) => {
                  void applyProviderPatch({ providerId: event.target.value });
                }}
              />
              <datalist id="provider-options">
                {providerOptions.map((providerId) => (
                  <option key={providerId} value={providerId} />
                ))}
              </datalist>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-muted">API key</span>
              <input
                autoComplete="off"
                className="rounded-xl border border-line bg-bg px-3 py-2 text-text outline-none focus-visible:border-accent"
                placeholder="Stored locally in chrome.storage.local"
                value={snapshot.settings.dataProvider.apiKey ?? ''}
                onChange={(event) => {
                  void applyProviderPatch({ apiKey: event.target.value.length > 0 ? event.target.value : null });
                }}
              />
            </label>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Local extension storage is convenient, but it does not make a browser-side API key secret.
          </p>
          <p className="mt-2 text-xs text-muted">
            Last successful refresh: {snapshot.quoteCache.lastSuccessfulRefreshAt ?? 'none'}
          </p>
          <label className="mt-4 grid gap-2 text-sm">
            <span className="text-muted">Provider symbol overrides JSON</span>
            <textarea
              className="min-h-36 rounded-xl border border-line bg-bg px-3 py-2 font-mono text-xs leading-5 text-text outline-none focus-visible:border-accent"
              value={providerOverridesText}
              onChange={(event) => {
                setProviderOverridesText(event.target.value);
              }}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-text transition hover:border-accent"
              onClick={() => {
                setProviderOverridesText(JSON.stringify(snapshot.settings.providerSymbolOverrides, null, 2));
                updateStatus('Loaded provider symbol overrides into the editor.');
              }}
              type="button"
            >
              Load overrides
            </button>
            <button
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-text transition hover:border-accent"
              onClick={() => {
                void saveProviderOverridesFromJson();
              }}
              type="button"
            >
              Save overrides
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-line/80 bg-bg/50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Quick links</h3>
          <label className="mt-4 grid gap-2 text-sm">
            <span className="text-muted">Quick links JSON</span>
            <textarea
              className="min-h-36 rounded-xl border border-line bg-bg px-3 py-2 font-mono text-xs leading-5 text-text outline-none focus-visible:border-accent"
              value={quickLinksText}
              onChange={(event) => {
                setQuickLinksText(event.target.value);
              }}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-text transition hover:border-accent"
              onClick={() => {
                setQuickLinksText(createQuickLinksJson(snapshot.settings.quickLinks));
                updateStatus('Loaded current quick links into the editor.');
              }}
              type="button"
            >
              Load current
            </button>
            <button
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-text transition hover:border-accent"
              onClick={() => {
                void saveQuickLinksFromJson();
              }}
              type="button"
            >
              Save quick links
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-line/80 bg-bg/50 p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Data management</h3>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                checked={includeSecrets}
                className="h-4 w-4 rounded border-line bg-transparent text-accent"
                onChange={(event) => {
                  setIncludeSecrets(event.target.checked);
                }}
                type="checkbox"
              />
              Include secrets in export
            </label>
            <button
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-text transition hover:border-accent"
              onClick={() => {
                void exportSettings();
              }}
              type="button"
            >
              Export settings
            </button>
            <button
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-text transition hover:border-accent"
              onClick={() => {
                void importSettings();
              }}
              type="button"
            >
              Import settings
            </button>
            <button
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-text transition hover:border-accent"
              onClick={() => {
                void handleClearQuoteCache();
              }}
              type="button"
            >
              Clear quote cache
            </button>
            <button
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-text transition hover:border-accent"
              onClick={() => {
                void handleResetPreferences();
              }}
              type="button"
            >
              Reset preferences
            </button>
            <button
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-text transition hover:border-accent"
              onClick={() => {
                void handleClearAllData();
              }}
              type="button"
            >
              Clear all extension data
            </button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-sm">
              <span className="text-muted">Import / export JSON</span>
              <textarea
                className="min-h-40 rounded-xl border border-line bg-bg px-3 py-2 font-mono text-xs leading-5 text-text outline-none focus-visible:border-accent"
                value={jsonText}
                onChange={(event) => {
                  setJsonText(event.target.value);
                }}
                placeholder="Paste exported settings JSON here"
              />
            </label>
            <div className="grid gap-2 text-xs text-muted lg:items-start">
              <p>Schema version: {snapshot.settingsSchemaVersion}</p>
              <p>Enabled markets: {snapshot.settings.enabledMarketIds.length}</p>
              <p>Stored quick links: {snapshot.settings.quickLinks.length}</p>
              <p>Quote cache entries: {snapshot.quoteCache.quotes.length}</p>
              <p>Export excludes API keys unless you opt in.</p>
            </div>
          </div>
        </section>
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-muted">
        {status ?? 'Use these controls to verify persistence and migration behavior.'}
      </p>
    </section>
  );
}
