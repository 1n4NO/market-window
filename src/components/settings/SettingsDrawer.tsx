import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Download,
  X,
} from 'lucide-react';
import { MARKET_DEFINITIONS } from '../../config/markets';
import { type QuickLink, type UserSettings, type MarketClockState } from '../../domain/market';
import { validateQuickLink } from '../../domain/validation';
import { ErrorNotice } from '../feedback/ErrorNotice';
import { StatusBadge } from '../feedback/StatusBadge';
import { Card } from '../layout/Card';
import { IconButton } from '../layout/IconButton';
import { classNames } from '../../utils/classNames';
import { useExtensionStorage } from '../../hooks/useExtensionStorage';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { createDefaultSettings } from '../../services/storage/extensionStorage';
import {
  MARKET_DATA_PROVIDERS,
  createMarketQuoteCacheService,
  getMarketDataProvider,
  resolveActiveMarketDataProviderId,
  type ProviderValidationResult,
  type SymbolValidationResult,
} from '../../services/marketData';

type SettingsSection = 'markets' | 'provider' | 'appearance' | 'quick-links' | 'data';

const SECTION_ORDER: SettingsSection[] = ['markets', 'provider', 'appearance', 'quick-links', 'data'];

const SECTION_TITLES: Record<SettingsSection, string> = {
  markets: 'Markets',
  provider: 'Data provider',
  appearance: 'Appearance',
  'quick-links': 'Quick links',
  data: 'Data management',
};

const PROVIDER_OPTIONS = [
  { id: 'twelvedata', label: 'Twelve Data' },
  { id: 'mock', label: 'Demo / Mock' },
] as const;

function getDefaultSymbol(marketId: string, providerId: string): string {
  const market = MARKET_DEFINITIONS.find((entry) => entry.id === marketId);
  if (!market) {
    return '';
  }
  return market.providerSymbols.find((symbol) => symbol.providerId === providerId)?.symbol ?? '';
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildQuickLinkDraft(current: QuickLink[], override?: QuickLink[]): QuickLink[] {
  const source = override ?? current;
  return source
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((link, index) => ({ ...link, order: index }));
}

function createQuickLink(index: number): QuickLink {
  return {
    id: `shortcut-${Date.now()}-${index}`,
    label: 'New link',
    url: 'https://www.google.com',
    enabled: true,
    order: index,
  };
}

function reindexQuickLinks(quickLinks: QuickLink[]): QuickLink[] {
  return quickLinks.map((link, index) => ({ ...link, order: index }));
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
}

function providerTone(result: ProviderValidationResult | null): 'neutral' | 'positive' | 'warning' | 'negative' | 'accent' {
  if (!result) {
    return 'neutral';
  }
  if (result.valid) {
    return 'positive';
  }
  if (result.code === 'rate_limited' || result.code === 'invalid_api_key') {
    return 'warning';
  }
  return 'negative';
}

function normalizeSections(sections: readonly SettingsSection[]): SettingsSection[] {
  const available = SECTION_ORDER.filter((section) => sections.includes(section));
  return available.length > 0 ? available : [...SECTION_ORDER];
}

function useSettingsSections(open: boolean, initialSection: SettingsSection, availableSections: readonly SettingsSection[]) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const availableSectionsKey = availableSections.join('|');
  const availableSectionsRef = useRef(availableSections);

  useEffect(() => {
    availableSectionsRef.current = availableSections;
  }, [availableSections, availableSectionsKey]);

  useEffect(() => {
    if (open) {
      const currentAvailableSections = availableSectionsRef.current;
      if (currentAvailableSections.includes(initialSection)) {
        setSection(initialSection);
      } else {
        setSection(currentAvailableSections[0] ?? initialSection);
      }
    }
  }, [availableSections, availableSectionsKey, initialSection, open]);

  return { section, setSection };
}

export function SettingsDrawer({
  open,
  initialSection = 'markets',
  availableSections = SECTION_ORDER,
  title = 'Settings',
  description = 'Manage markets, provider credentials, appearance, quick links, and local data without reloading the page.',
  onClose,
  marketStates,
  now,
}: {
  open: boolean;
  initialSection?: SettingsSection;
  availableSections?: readonly SettingsSection[];
  title?: string;
  description?: string;
  onClose: () => void;
  marketStates: Record<string, MarketClockState>;
  now: Date;
}) {
  const { controller, snapshot } = useExtensionStorage();
  const sections = useMemo(() => normalizeSections(availableSections), [availableSections]);
  const { section, setSection } = useSettingsSections(open, initialSection, sections);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ProviderValidationResult | null>(null);
  const [symbolValidationResults, setSymbolValidationResults] = useState<SymbolValidationResult[]>([]);
  const [quickLinkErrorIds, setQuickLinkErrorIds] = useState<string[]>([]);
  const quoteCacheService = useMemo(() => createMarketQuoteCacheService(controller, MARKET_DATA_PROVIDERS), [controller]);
  const isOnline = useOnlineStatus();

  const settings = snapshot.settings;
  const defaultSettings = useMemo(() => createDefaultSettings(), []);
  const enabledMarkets = useMemo(
    () =>
      MARKET_DEFINITIONS.filter((market) => settings.enabledMarketIds.includes(market.id)).sort(
        (left, right) => settings.marketOrder.indexOf(left.id) - settings.marketOrder.indexOf(right.id),
      ),
    [settings.enabledMarketIds, settings.marketOrder],
  );
  const providerId = settings.dataProvider.providerId;
  const providerSelection = PROVIDER_OPTIONS.find((option) => option.id === providerId) ?? PROVIDER_OPTIONS[0];
  const activeProviderId = resolveActiveMarketDataProviderId(providerId, settings.dataProvider.apiKey);

  useEffect(() => {
    setQuickLinkErrorIds(
      settings.quickLinks.filter((quickLink) => !isValidHttpUrl(quickLink.url)).map((quickLink) => quickLink.id),
    );
  }, [settings.quickLinks]);

  useEffect(() => {
    if (!open) {
      return;
    }

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const container = drawerRef.current;
      if (!container) {
        return;
      }
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      window.requestAnimationFrame(() => {
        restoreFocusRef.current?.focus();
      });
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setConnectionResult(null);
    setSymbolValidationResults([]);
    setStatusMessage(null);
  }, [open]);

  async function saveSettings(nextSettings: UserSettings): Promise<void> {
    await controller.setSettings(nextSettings);
  }

  async function patchSettings(patch: Partial<UserSettings>): Promise<void> {
    await saveSettings({
      ...settings,
      ...patch,
      appearance: {
        ...settings.appearance,
        ...patch.appearance,
      },
      dataProvider: {
        ...settings.dataProvider,
        ...patch.dataProvider,
      },
    });
  }

  function setStatus(message: string): void {
    setStatusMessage(message);
  }

  function updateQuickLinks(nextQuickLinks: QuickLink[]): Promise<void> {
    setQuickLinkErrorIds(nextQuickLinks.filter((quickLink) => !isValidHttpUrl(quickLink.url)).map((quickLink) => quickLink.id));
    return saveSettings({
      ...settings,
      quickLinks: reindexQuickLinks(nextQuickLinks),
    });
  }

  async function setEnabledMarket(marketId: string, enabled: boolean): Promise<void> {
    const nextEnabled = enabled
      ? Array.from(new Set([...settings.enabledMarketIds, marketId]))
      : settings.enabledMarketIds.filter((id) => id !== marketId);
    const nextOrder = settings.marketOrder.filter((id) => nextEnabled.includes(id));
    for (const id of nextEnabled) {
      if (!nextOrder.includes(id)) {
        nextOrder.push(id);
      }
    }
    await saveSettings({
      ...settings,
      enabledMarketIds: nextEnabled,
      marketOrder: nextOrder,
    });
    setStatus(enabled ? 'Market enabled.' : 'Market disabled.');
  }

  async function moveEnabledMarket(marketId: string, direction: -1 | 1): Promise<void> {
    const currentOrder = settings.marketOrder.filter((id) => settings.enabledMarketIds.includes(id));
    const nextOrder = moveItem(currentOrder, currentOrder.indexOf(marketId), direction);
    const remaining = settings.marketOrder.filter((id) => !settings.enabledMarketIds.includes(id));
    await saveSettings({
      ...settings,
      marketOrder: [...nextOrder, ...remaining],
    });
  }

  async function restoreDefaultMarketOrder(): Promise<void> {
    await saveSettings({
      ...settings,
      enabledMarketIds: [...defaultSettings.enabledMarketIds],
      marketOrder: [...defaultSettings.marketOrder],
    });
    setStatus('Market order restored to defaults.');
  }

  async function updateProviderSymbol(marketId: string, symbol: string): Promise<void> {
    const trimmed = symbol.trim();
    const nextOverrides = { ...settings.providerSymbolOverrides };
    const marketOverrides = { ...(nextOverrides[marketId] ?? {}) };
    if (trimmed.length === 0) {
      delete marketOverrides[providerId];
    } else {
      marketOverrides[providerId] = trimmed;
    }
    if (Object.keys(marketOverrides).length > 0) {
      nextOverrides[marketId] = marketOverrides;
    } else {
      delete nextOverrides[marketId];
    }
    await patchSettings({ providerSymbolOverrides: nextOverrides });
    setStatus('Provider symbol override saved.');
  }

  async function restoreDefaultSymbols(): Promise<void> {
    await patchSettings({ providerSymbolOverrides: {} });
    setSymbolValidationResults([]);
    setStatus('Provider symbols restored to defaults.');
  }

  async function handleProviderChange(nextProviderId: string): Promise<void> {
    setConnectionResult(null);
    setSymbolValidationResults([]);
    await patchSettings({
      dataProvider: {
        ...settings.dataProvider,
        providerId: nextProviderId,
      },
    });
  }

  async function handleKeyChange(apiKey: string): Promise<void> {
    setConnectionResult(null);
    setSymbolValidationResults([]);
    await patchSettings({
      dataProvider: {
        ...settings.dataProvider,
        apiKey: apiKey.length > 0 ? apiKey : null,
      },
    });
  }

  async function testConnection(): Promise<void> {
    const selectedProvider = getMarketDataProvider(settings.dataProvider.providerId);
    if (!selectedProvider) {
      const result: ProviderValidationResult = {
        valid: false,
        code: 'provider_unavailable',
        message: 'Selected provider is unavailable.',
      };
      setConnectionResult(result);
      setStatus(result.message ?? 'Selected provider is unavailable.');
      return;
    }

    const apiKey = settings.dataProvider.apiKey ?? '';
    const result = await selectedProvider.validateApiKey(apiKey);
    setConnectionResult(result);

    if (!result.valid) {
      setSymbolValidationResults([]);
      setStatus(result.message ?? 'Connection failed.');
      return;
    }

    if (selectedProvider.id === 'mock') {
      setSymbolValidationResults([]);
      setStatus(result.message ?? 'Demo provider is ready.');
      return;
    }

    const symbolResults = await quoteCacheService.validateConfiguredSymbols(
      enabledMarkets,
      selectedProvider.id,
      apiKey,
      settings.providerSymbolOverrides,
    );
    setSymbolValidationResults(symbolResults);
    const invalidSymbols = symbolResults.filter((entry) => !entry.valid);
    setStatus(
      invalidSymbols.length > 0
        ? `Connection successful, but ${invalidSymbols.length} symbol override${invalidSymbols.length === 1 ? '' : 's'} need attention.`
        : result.message ?? 'Connection successful.',
    );
  }

  async function refreshNow(): Promise<void> {
    if (!isOnline) {
      setStatus('Offline: cached quotes remain visible until connection returns.');
      return;
    }
    const refreshResults = await quoteCacheService.refreshQuotes({
      markets: enabledMarkets,
      marketStates,
      providerId: activeProviderId,
      apiKey: settings.dataProvider.apiKey ?? '',
      now,
      overrides: settings.providerSymbolOverrides,
    });
    const updated = refreshResults.filter((result) => result.status === 'updated').length;
    const failed = refreshResults.filter((result) => result.status === 'failed').length;
    setStatus(
      failed > 0
        ? `Refreshed ${updated} market${updated === 1 ? '' : 's'} with ${failed} failure${failed === 1 ? '' : 's'}.`
        : `Refreshed ${updated} market${updated === 1 ? '' : 's'} successfully.`,
    );
  }

  function confirmDanger(message: string): boolean {
    return window.confirm(message);
  }

  async function clearQuoteCacheAction(): Promise<void> {
    if (!confirmDanger('Clear the cached quotes? This removes local quote data only.')) {
      return;
    }
    await controller.clearQuoteCache();
    setStatus('Quote cache cleared.');
  }

  async function resetPreferencesAction(): Promise<void> {
    if (!confirmDanger('Reset all preferences to defaults? This will keep quote cache until you clear it separately.')) {
      return;
    }
    await controller.resetPreferences();
    setStatus('Preferences reset to defaults.');
  }

  async function clearAllExtensionDataAction(): Promise<void> {
    if (!confirmDanger('Clear all extension data? This removes settings and cached quotes.')) {
      return;
    }
    await controller.clearAllExtensionData();
    setStatus('All extension data cleared.');
  }

  async function exportSettings(): Promise<void> {
    const json = controller.exportSettings(includeSecrets);
    setExportText(json);
    setImportText(json);
    setStatus(includeSecrets ? 'Exported settings including secrets.' : 'Exported settings without the API key.');
  }

  async function importSettings(): Promise<void> {
    const result = await controller.importSettingsJson(importText);
    if (!result.valid) {
      setStatus(result.errors.map((error) => `${error.path || 'settings'}: ${error.message}`).join(' '));
      return;
    }
    setStatus('Imported settings successfully.');
  }

  async function restoreDefaultQuickLinks(): Promise<void> {
    await saveSettings({
      ...settings,
      quickLinks: reindexQuickLinks(defaultSettings.quickLinks),
    });
    setQuickLinkErrorIds([]);
    setStatus('Quick links restored to defaults.');
  }

  if (!open) {
    return null;
  }

  const connectionStateTone = providerTone(connectionResult);
  const symbolFailureMap = new Map(symbolValidationResults.filter((result) => !result.valid).map((result) => [result.marketId, result]));
  const showNav = sections.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 p-3 sm:p-5" role="presentation">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        ref={drawerRef}
        aria-label="Settings"
        aria-modal="true"
        className="relative z-10 flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[color:var(--mw-border)] bg-[color:var(--mw-page)] shadow-[var(--mw-shadow-card)]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--mw-border)] px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">{title}</p>
            <h2 id="settings-title" className="text-xl font-semibold text-[color:var(--mw-text)]">
              {SECTION_TITLES[section]}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--mw-text-secondary)]">{description}</p>
          </div>
          <IconButton ref={closeButtonRef} aria-label="Close settings" onClick={onClose} tone="subtle" type="button">
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="grid min-h-0 flex-1 gap-0">
          {showNav ? (
            <nav aria-label="Settings sections" className="border-b border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-3 md:border-b-0 md:border-r md:w-[220px]">
              <div className="grid gap-2">
                {sections.map((item) => (
                  <button
                    key={item}
                    aria-pressed={section === item}
                    className={classNames(
                      'flex items-center justify-between rounded-[16px] border px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]',
                      section === item
                        ? 'border-[color:var(--mw-border-strong)] bg-[color:var(--mw-panel)] text-[color:var(--mw-text)] shadow-[var(--mw-shadow-lift)]'
                        : 'border-transparent bg-transparent text-[color:var(--mw-text-secondary)] hover:border-[color:var(--mw-border)] hover:bg-[color:var(--mw-panel)] hover:text-[color:var(--mw-text)]',
                    )}
                    onClick={() => setSection(item)}
                    type="button"
                  >
                    <span>{SECTION_TITLES[item]}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                      {item === 'data' ? 'local' : item === 'provider' ? 'key' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </nav>
          ) : null}

          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <div aria-labelledby="settings-title" className="grid gap-4">
              {section === 'markets' ? (
                <>
                  <Card className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Markets</p>
                        <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Enable, disable, and reorder</h3>
                      </div>
                      <IconButton onClick={restoreDefaultMarketOrder} tone="subtle" type="button">
                        <RotateCcw className="h-4 w-4" />
                        Restore default order
                      </IconButton>
                    </div>
                    <div className="grid gap-3">
                      {MARKET_DEFINITIONS.map((market) => {
                        const enabled = settings.enabledMarketIds.includes(market.id);
                        const enabledIndex = enabledMarkets.findIndex((item) => item.id === market.id);
                        return (
                          <div
                            key={market.id}
                            className="grid gap-3 rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <label className="flex items-start gap-3">
                                <input
                                  checked={enabled}
                                  className="mt-1 h-4 w-4 rounded border-[color:var(--mw-border)] bg-transparent text-[color:var(--mw-focus)]"
                                  onChange={(event) => {
                                    void setEnabledMarket(market.id, event.target.checked);
                                  }}
                                  type="checkbox"
                                />
                                <span className="space-y-1">
                                  <span className="block text-sm font-medium text-[color:var(--mw-text)]">
                                    {market.exchangeCode} {market.indexName}
                                  </span>
                                  <span className="block text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                                    {market.country} · {market.timezone}
                                  </span>
                                </span>
                              </label>

                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge tone={enabled ? 'positive' : 'neutral'}>{enabled ? 'Enabled' : 'Disabled'}</StatusBadge>
                                <IconButton disabled={!enabled || enabledIndex <= 0} onClick={() => void moveEnabledMarket(market.id, -1)} tone="subtle" type="button">
                                  <ArrowUp className="h-4 w-4" />
                                </IconButton>
                                <IconButton
                                  disabled={!enabled || enabledIndex < 0 || enabledIndex >= enabledMarkets.length - 1}
                                  onClick={() => void moveEnabledMarket(market.id, 1)}
                                  tone="subtle"
                                  type="button"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </IconButton>
                              </div>
                            </div>
                            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                              Index {market.indexName} · Timezone {market.timezone}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </>
              ) : null}

              {section === 'provider' ? (
                <>
                  <Card className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Data provider</p>
                        <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Provider and API key</h3>
                      </div>
                      <StatusBadge tone={connectionStateTone}>
                        {connectionResult ? (connectionResult.valid ? 'Connected' : connectionResult.code.replace(/_/g, ' ')) : providerSelection.label}
                      </StatusBadge>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                      <label className="grid gap-2 text-sm">
                        <span className="text-[color:var(--mw-text-muted)]">Provider</span>
                        <select
                          className="rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] px-3 py-2.5 text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                          onChange={(event) => {
                            void handleProviderChange(event.target.value);
                          }}
                          value={settings.dataProvider.providerId}
                        >
                          {PROVIDER_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm">
                        <span className="text-[color:var(--mw-text-muted)]">API key</span>
                        <div className="flex items-center gap-2">
                          <input
                            autoComplete="off"
                            className="min-w-0 flex-1 rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] px-3 py-2.5 text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                            onChange={(event) => {
                              void handleKeyChange(event.target.value);
                            }}
                            placeholder="Stored locally only"
                            type={showApiKey ? 'text' : 'password'}
                            value={settings.dataProvider.apiKey ?? ''}
                          />
                          <IconButton
                            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                            onClick={() => {
                              setShowApiKey((current) => !current);
                            }}
                            tone="subtle"
                            type="button"
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </IconButton>
                        </div>
                      </label>
                    </div>

                    <p className="text-xs leading-5 text-[color:var(--mw-text-secondary)]">
                      Browser-local storage is convenient, but it does not make a browser-side API key secret.
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <IconButton onClick={() => void testConnection()} tone="default" type="button">
                        <Search className="h-4 w-4" />
                        Test connection
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          void handleKeyChange('');
                          setStatus('API key removed.');
                        }}
                        tone="subtle"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove key
                      </IconButton>
                      <IconButton onClick={() => void restoreDefaultSymbols()} tone="subtle" type="button">
                        <RotateCcw className="h-4 w-4" />
                        Restore default symbols
                      </IconButton>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {enabledMarkets.map((market) => {
                        const currentSymbol = settings.providerSymbolOverrides[market.id]?.[providerId] ?? getDefaultSymbol(market.id, providerId);
                        const validation = symbolFailureMap.get(market.id);
                        return (
                          <div
                            key={market.id}
                            className="grid gap-3 rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-[color:var(--mw-text)]">{market.exchangeCode}</p>
                                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">{market.indexName}</p>
                              </div>
                              <StatusBadge tone={validation ? 'negative' : 'neutral'}>
                                {validation ? 'Symbol issue' : currentSymbol ? 'Mapped' : 'Default'}
                              </StatusBadge>
                            </div>

                            <label className="grid gap-2 text-sm">
                              <span className="text-[color:var(--mw-text-muted)]">Symbol override</span>
                              <input
                                className="rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] px-3 py-2.5 font-mono text-sm text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                                onChange={(event) => {
                                  void updateProviderSymbol(market.id, event.target.value);
                                }}
                                placeholder={`Default: ${getDefaultSymbol(market.id, providerId) || 'not set'}`}
                                value={currentSymbol}
                              />
                            </label>
                            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                              Default: {getDefaultSymbol(market.id, providerId) || 'none'}
                            </p>
                            {validation ? (
                              <ErrorNotice
                                className="w-full"
                                message={`${validation.message ?? 'Symbol validation failed.'} Restore the default symbol for ${market.exchangeCode} or edit the override.`}
                                title="Symbol unavailable"
                              />
                            ) : null}
                            <div className="flex flex-wrap items-center gap-2">
                              <IconButton
                                onClick={() => {
                                  void updateProviderSymbol(market.id, '');
                                }}
                                tone="subtle"
                                type="button"
                              >
                                Restore default
                              </IconButton>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {connectionResult ? (
                      <StatusBadge tone={providerTone(connectionResult)}>
                        {connectionResult.message ?? 'Connection checked'}
                      </StatusBadge>
                    ) : null}
                  </Card>
                </>
              ) : null}

              {section === 'appearance' ? (
                <Card className="space-y-4 p-5 sm:p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Appearance</p>
                    <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Density and visibility</h3>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="grid gap-2 text-sm">
                      <span className="text-[color:var(--mw-text-muted)]">Density</span>
                      <select
                        className="rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] px-3 py-2.5 text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                        onChange={(event) => {
                          void patchSettings({
                            appearance: {
                              ...settings.appearance,
                              density: event.target.value === 'compact' ? 'compact' : 'comfortable',
                            },
                          });
                        }}
                        value={settings.appearance.density}
                      >
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact</option>
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="text-[color:var(--mw-text-muted)]">Clock format</span>
                      <select
                        className="rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] px-3 py-2.5 text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                        onChange={(event) => {
                          void patchSettings({
                            appearance: {
                              ...settings.appearance,
                              clockFormat: event.target.value === '12h' ? '12h' : '24h',
                            },
                          });
                        }}
                        value={settings.appearance.clockFormat}
                      >
                        <option value="24h">24-hour</option>
                        <option value="12h">12-hour</option>
                      </select>
                    </label>

                    <label className="flex items-center gap-3 rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] px-3 py-3 text-sm">
                      <input
                        checked={settings.appearance.showSearch}
                        className="h-4 w-4 rounded border-[color:var(--mw-border)] bg-transparent text-[color:var(--mw-focus)]"
                        onChange={(event) => {
                          void patchSettings({
                            appearance: {
                              ...settings.appearance,
                              showSearch: event.target.checked,
                            },
                          });
                        }}
                        type="checkbox"
                      />
                      <span>Show search</span>
                    </label>

                    <label className="flex items-center gap-3 rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] px-3 py-3 text-sm">
                      <input
                        checked={settings.appearance.showQuickLinks}
                        className="h-4 w-4 rounded border-[color:var(--mw-border)] bg-transparent text-[color:var(--mw-focus)]"
                        onChange={(event) => {
                          void patchSettings({
                            appearance: {
                              ...settings.appearance,
                              showQuickLinks: event.target.checked,
                            },
                          });
                        }}
                        type="checkbox"
                      />
                      <span>Show quick links</span>
                    </label>
                  </div>
                </Card>
              ) : null}

              {section === 'quick-links' ? (
                <Card className="space-y-4 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Quick links</p>
                      <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Add, edit, delete, and reorder</h3>
                    </div>
                    <IconButton onClick={() => void restoreDefaultQuickLinks()} tone="subtle" type="button">
                      <RotateCcw className="h-4 w-4" />
                      Restore defaults
                    </IconButton>
                  </div>

                  <div className="grid gap-3">
                    {buildQuickLinkDraft(settings.quickLinks).map((link, index) => {
                      const hasUrlIssue = quickLinkErrorIds.includes(link.id);
                      return (
                        <div
                          key={link.id}
                          className="grid gap-3 rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="flex items-center gap-3 text-sm">
                              <input
                                checked={link.enabled}
                                className="h-4 w-4 rounded border-[color:var(--mw-border)] bg-transparent text-[color:var(--mw-focus)]"
                                onChange={(event) => {
                                  void updateQuickLinks(
                                    settings.quickLinks.map((item) =>
                                      item.id === link.id ? { ...item, enabled: event.target.checked } : item,
                                    ),
                                  );
                                }}
                                type="checkbox"
                              />
                              <span>Enabled</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <IconButton
                                aria-label={`Move ${link.label} up`}
                                disabled={index === 0}
                                onClick={() => {
                                  void updateQuickLinks(reindexQuickLinks(moveItem(buildQuickLinkDraft(settings.quickLinks), index, -1)));
                                }}
                                tone="subtle"
                                type="button"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </IconButton>
                              <IconButton
                                aria-label={`Move ${link.label} down`}
                                disabled={index === settings.quickLinks.length - 1}
                                onClick={() => {
                                  void updateQuickLinks(reindexQuickLinks(moveItem(buildQuickLinkDraft(settings.quickLinks), index, 1)));
                                }}
                                tone="subtle"
                                type="button"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </IconButton>
                              <IconButton
                                aria-label={`Delete ${link.label}`}
                                onClick={() => {
                                  void updateQuickLinks(settings.quickLinks.filter((item) => item.id !== link.id));
                                }}
                                tone="subtle"
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            </div>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-2">
                            <label className="grid gap-2 text-sm">
                              <span className="text-[color:var(--mw-text-muted)]">Label</span>
                              <input
                                className="rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] px-3 py-2.5 text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                                onChange={(event) => {
                                  void updateQuickLinks(
                                    settings.quickLinks.map((item) =>
                                      item.id === link.id ? { ...item, label: event.target.value } : item,
                                    ),
                                  );
                                }}
                                value={link.label}
                              />
                            </label>
                            <label className="grid gap-2 text-sm">
                              <span className="text-[color:var(--mw-text-muted)]">URL</span>
                              <input
                                className="rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] px-3 py-2.5 font-mono text-sm text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                                onChange={(event) => {
                                  void updateQuickLinks(
                                    settings.quickLinks.map((item) =>
                                      item.id === link.id ? { ...item, url: event.target.value } : item,
                                    ),
                                  );
                                }}
                                value={link.url}
                              />
                            </label>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {hasUrlIssue ? <StatusBadge tone="warning">Invalid URL</StatusBadge> : <StatusBadge tone="neutral">URL valid</StatusBadge>}
                              {validateQuickLink(link).valid ? null : <StatusBadge tone="warning">Incomplete</StatusBadge>}
                            </div>
                            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                              Order {link.order + 1}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <IconButton
                      onClick={() => {
                        void updateQuickLinks([...buildQuickLinkDraft(settings.quickLinks), createQuickLink(settings.quickLinks.length)]);
                      }}
                      type="button"
                    >
                      Add link
                    </IconButton>
                    <StatusBadge tone="neutral">{settings.quickLinks.filter((link) => link.enabled).length} visible</StatusBadge>
                  </div>
                </Card>
              ) : null}

              {section === 'data' ? (
                <Card className="space-y-4 p-5 sm:p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Data management</p>
                    <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Refresh, export, and reset</h3>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[color:var(--mw-text)]">Refresh now</p>
                          <p className="mt-1 text-sm leading-6 text-[color:var(--mw-text-secondary)]">
                            Fetch market quotes immediately using the selected provider and the current symbol overrides.
                          </p>
                          {!isOnline ? (
                            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                              Offline mode: local market clocks and cached quotes stay available.
                            </p>
                          ) : null}
                        </div>
                        <IconButton disabled={!isOnline} onClick={() => void refreshNow()} type="button">
                          <RefreshCw className="h-4 w-4" />
                          Refresh now
                        </IconButton>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                      <p className="text-sm font-medium text-[color:var(--mw-text)]">Quote cache</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--mw-text-secondary)]">
                        Clear stale quote entries while preserving your market preferences.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <IconButton onClick={() => void clearQuoteCacheAction()} tone="subtle" type="button">
                          <Trash2 className="h-4 w-4" />
                          Clear quote cache
                        </IconButton>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                      <p className="text-sm font-medium text-[color:var(--mw-text)]">Export settings</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--mw-text-secondary)]">
                        Export preferences and local shortcuts. API keys stay excluded unless you explicitly opt in.
                      </p>
                      <label className="mt-3 flex items-center gap-2 text-sm">
                        <input
                          checked={includeSecrets}
                          className="h-4 w-4 rounded border-[color:var(--mw-border)] bg-transparent text-[color:var(--mw-focus)]"
                          onChange={(event) => {
                            setIncludeSecrets(event.target.checked);
                          }}
                          type="checkbox"
                        />
                        Include API key in export
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <IconButton onClick={() => void exportSettings()} tone="subtle" type="button">
                          <Download className="h-4 w-4" />
                          Export settings
                        </IconButton>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                      <p className="text-sm font-medium text-[color:var(--mw-text)]">Import settings</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--mw-text-secondary)]">
                        Paste exported JSON. The import is validated before anything is written to local storage.
                      </p>
                      <label className="mt-3 grid gap-2 text-sm">
                        <span className="text-[color:var(--mw-text-muted)]">JSON</span>
                        <textarea
                          className="min-h-32 rounded-[16px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] px-3 py-2.5 font-mono text-xs leading-5 text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                          onChange={(event) => {
                            setImportText(event.target.value);
                          }}
                          value={importText}
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <IconButton onClick={() => void importSettings()} tone="subtle" type="button">
                          <Upload className="h-4 w-4" />
                          Import settings
                        </IconButton>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">Last refresh</p>
                      <p className="mt-2 text-sm text-[color:var(--mw-text)]">{snapshot.quoteCache.lastSuccessfulRefreshAt ?? 'none'}</p>
                    </div>
                    <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">Settings export</p>
                      <p className="mt-2 text-sm text-[color:var(--mw-text)]">{exportText ? 'Ready' : 'Not exported yet'}</p>
                    </div>
                    <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">Quote cache entries</p>
                      <p className="mt-2 text-sm text-[color:var(--mw-text)]">{snapshot.quoteCache.quotes.length}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <IconButton onClick={() => void resetPreferencesAction()} tone="subtle" type="button">
                      <RotateCcw className="h-4 w-4" />
                      Reset preferences
                    </IconButton>
                    <IconButton onClick={() => void clearAllExtensionDataAction()} tone="subtle" type="button">
                      <Trash2 className="h-4 w-4" />
                      Clear all extension data
                    </IconButton>
                    <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">Current provider</p>
                      <p className="mt-2 text-sm text-[color:var(--mw-text)]">{providerSelection.label}</p>
                    </div>
                  </div>
                </Card>
              ) : null}

              {statusMessage || connectionResult || symbolValidationResults.some((result) => !result.valid) || quickLinkErrorIds.length > 0 ? (
                <div className="grid gap-3">
                  {statusMessage ? (
                    <StatusBadge tone="neutral">
                      <span className="normal-case tracking-normal">{statusMessage}</span>
                    </StatusBadge>
                  ) : null}
                  {connectionResult ? (
                    <ErrorNotice
                      title={connectionResult.valid ? 'Connection successful' : 'Connection issue'}
                      message={connectionResult.message ?? 'Provider check completed.'}
                    />
                  ) : null}
                  {symbolValidationResults.some((result) => !result.valid) ? (
                    <ErrorNotice
                      title="Symbol validation needs attention"
                      message="One or more configured provider symbols could not be resolved. Restore the default symbol for each affected market or edit the override."
                    />
                  ) : null}
                  {quickLinkErrorIds.length > 0 ? (
                    <ErrorNotice
                      title="Quick-link URL issue"
                      message="One or more quick links has an invalid URL. Use a valid http:// or https:// destination."
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
