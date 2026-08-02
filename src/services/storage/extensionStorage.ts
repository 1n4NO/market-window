import { MARKET_DEFINITIONS } from '../../config/markets';
import type { MarketQuote, QuickLink, UserSettings } from '../../domain/market';
import { validateUserSettings } from '../../domain/validation';

export const STORAGE_SCHEMA_VERSION = 1 as const;
export const STORAGE_SETTINGS_KEY = 'market-window.settings';
export const STORAGE_QUOTE_CACHE_KEY = 'market-window.quote-cache';

const DEFAULT_PROVIDER_ID = 'twelvedata';

export interface CachedQuoteEntry {
  marketId: string;
  quote: MarketQuote;
  fetchedAt: string;
  providerTimestamp: string | null;
  expiresAt: string | null;
  retryAfterAt: string | null;
  providerId: string;
}

export interface QuoteCacheState {
  quotes: CachedQuoteEntry[];
  lastSuccessfulRefreshAt: string | null;
}

export interface StorageSnapshot {
  settingsSchemaVersion: number;
  settings: UserSettings;
  quoteCache: QuoteCacheState;
}

export interface StorageExportEnvelope {
  schemaVersion: typeof STORAGE_SCHEMA_VERSION;
  settings: UserSettings;
}

export interface StorageAdapterChange {
  oldValue: unknown;
  newValue: unknown;
}

export type StorageAdapterChangeMap = Record<string, StorageAdapterChange>;

export interface StorageAdapter {
  get(keys?: string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[] | string): Promise<void>;
  clear(): Promise<void>;
  subscribe(listener: (changes: StorageAdapterChangeMap) => void): () => void;
}

export interface SettingsValidationError {
  path: string;
  message: string;
}

export interface SettingsImportResult {
  valid: boolean;
  errors: SettingsValidationError[];
  settings?: UserSettings;
}

type StorageRecord = Record<string, unknown>;

function isRecord(value: unknown): value is StorageRecord {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function clone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function defaultQuickLinks(): QuickLink[] {
  return [
    {
      id: 'tradingview',
      label: 'TradingView',
      url: 'https://www.tradingview.com',
      enabled: true,
      order: 0,
    },
    {
      id: 'yahoo-finance',
      label: 'Yahoo Finance',
      url: 'https://finance.yahoo.com',
      enabled: true,
      order: 1,
    },
    {
      id: 'investing',
      label: 'Investing.com',
      url: 'https://www.investing.com',
      enabled: true,
      order: 2,
    },
    {
      id: 'marketwatch',
      label: 'MarketWatch',
      url: 'https://www.marketwatch.com',
      enabled: true,
      order: 3,
    },
  ];
}

export function createDefaultSettings(): UserSettings {
  const marketIds = MARKET_DEFINITIONS.map((market) => market.id);

  return {
    enabledMarketIds: [...marketIds],
    marketOrder: [...marketIds],
    quickLinks: defaultQuickLinks(),
    providerSymbolOverrides: {},
    appearance: {
      density: 'comfortable',
      clockFormat: '24h',
      showSearch: true,
      showQuickLinks: true,
    },
    dataProvider: {
      providerId: DEFAULT_PROVIDER_ID,
      apiKey: null,
    },
  };
}

export function createDefaultQuoteCache(): QuoteCacheState {
  return {
    quotes: [],
    lastSuccessfulRefreshAt: null,
  };
}

export function createDefaultSnapshot(): StorageSnapshot {
  return {
    settingsSchemaVersion: STORAGE_SCHEMA_VERSION,
    settings: createDefaultSettings(),
    quoteCache: createDefaultQuoteCache(),
  };
}

function normalizeQuickLinks(value: unknown): QuickLink[] {
  if (!Array.isArray(value)) {
    return defaultQuickLinks();
  }

  const normalized = value
    .filter(isRecord)
    .map((entry, index) => {
      const fallback = defaultQuickLinks()[index] ?? defaultQuickLinks()[0];

      return {
        id: isNonEmptyString(entry.id) ? entry.id : fallback.id,
        label: isNonEmptyString(entry.label) ? entry.label : fallback.label,
        url: isNonEmptyString(entry.url) ? entry.url : fallback.url,
        enabled: typeof entry.enabled === 'boolean' ? entry.enabled : fallback.enabled,
        order: Number.isInteger(entry.order) ? Number(entry.order) : fallback.order,
        iconId: isString(entry.iconId) ? entry.iconId : undefined,
      } satisfies QuickLink;
    });

  const deduped = new Map<string, QuickLink>();
  for (const link of normalized) {
    if (!deduped.has(link.id)) {
      deduped.set(link.id, link);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => left.order - right.order);
}

function normalizeProviderSymbolOverrides(value: unknown): UserSettings['providerSymbolOverrides'] {
  if (!isRecord(value)) {
    return {};
  }

  const overrides: UserSettings['providerSymbolOverrides'] = {};
  for (const [marketId, providerMap] of Object.entries(value)) {
    if (!isNonEmptyString(marketId) || !isRecord(providerMap)) {
      continue;
    }
    overrides[marketId] = {};
    for (const [providerId, symbol] of Object.entries(providerMap)) {
      if (isNonEmptyString(providerId) && isNonEmptyString(symbol)) {
        overrides[marketId][providerId] = symbol;
      }
    }
    if (Object.keys(overrides[marketId]).length === 0) {
      delete overrides[marketId];
    }
  }
  return overrides;
}

function normalizeEnabledMarketIds(value: unknown): string[] {
  const fallback = createDefaultSettings().enabledMarketIds;
  if (!Array.isArray(value)) {
    return fallback;
  }

  const marketIds = value.filter(
    (candidate): candidate is string =>
      isString(candidate) && MARKET_DEFINITIONS.some((market) => market.id === candidate),
  );
  return uniqueStrings(marketIds);
}

function normalizeMarketOrder(value: unknown, enabledMarketIds: string[]): string[] {
  const fallback = createDefaultSettings().marketOrder.filter((marketId) => enabledMarketIds.includes(marketId));
  if (!Array.isArray(value)) {
    return fallback;
  }

  const filtered = uniqueStrings(
    value.filter((candidate): candidate is string => isString(candidate) && enabledMarketIds.includes(candidate)),
  );
  const missing = enabledMarketIds.filter((marketId) => !filtered.includes(marketId));
  return [...filtered, ...missing];
}

function normalizeAppearance(value: unknown): UserSettings['appearance'] {
  const fallback = createDefaultSettings().appearance;
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    density: value.density === 'compact' || value.density === 'comfortable' ? value.density : fallback.density,
    clockFormat: value.clockFormat === '12h' || value.clockFormat === '24h' ? value.clockFormat : fallback.clockFormat,
    showSearch: typeof value.showSearch === 'boolean' ? value.showSearch : fallback.showSearch,
    showQuickLinks: typeof value.showQuickLinks === 'boolean' ? value.showQuickLinks : fallback.showQuickLinks,
  };
}

function normalizeDataProvider(value: unknown): UserSettings['dataProvider'] {
  const fallback = createDefaultSettings().dataProvider;
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    providerId: isNonEmptyString(value.providerId) ? value.providerId : fallback.providerId,
    apiKey: value.apiKey === null || isString(value.apiKey) ? value.apiKey : fallback.apiKey,
  };
}

function normalizeSettingsPayload(value: unknown): UserSettings {
  const fallback = createDefaultSettings();
  if (!isRecord(value)) {
    return fallback;
  }

  const enabledMarketIds = normalizeEnabledMarketIds(value.enabledMarketIds);
  return {
    enabledMarketIds,
    marketOrder: normalizeMarketOrder(value.marketOrder, enabledMarketIds),
    quickLinks: normalizeQuickLinks(value.quickLinks),
    providerSymbolOverrides: normalizeProviderSymbolOverrides(value.providerSymbolOverrides),
    appearance: normalizeAppearance(value.appearance),
    dataProvider: normalizeDataProvider(value.dataProvider),
  };
}

export function normalizeSettings(value: unknown): StorageExportEnvelope {
  const payload = isRecord(value) && 'settings' in value ? value.settings : value;
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    settings: normalizeSettingsPayload(payload),
  };
}

function normalizeQuoteEntry(value: unknown): CachedQuoteEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!isNonEmptyString(value.marketId)) {
    return null;
  }
  if (!isRecord(value.quote)) {
    return null;
  }

  const quote = value.quote;
  if (!isNonEmptyString(quote.marketId) || !isNonEmptyString(quote.symbol) || !isNonEmptyString(quote.indexName)) {
    return null;
  }
  if (quote.value !== null && typeof quote.value !== 'number') {
    return null;
  }
  if (quote.previousClose !== null && typeof quote.previousClose !== 'number') {
    return null;
  }
  if (quote.absoluteChange !== null && typeof quote.absoluteChange !== 'number') {
    return null;
  }
  if (quote.percentageChange !== null && typeof quote.percentageChange !== 'number') {
    return null;
  }
  if (quote.currency !== null && !isString(quote.currency)) {
    return null;
  }
  if (quote.asOf !== null && !isString(quote.asOf)) {
    return null;
  }
  if (quote.dayHigh !== undefined && quote.dayHigh !== null && typeof quote.dayHigh !== 'number') {
    return null;
  }
  if (quote.dayLow !== undefined && quote.dayLow !== null && typeof quote.dayLow !== 'number') {
    return null;
  }
  if (quote.intradaySeries !== undefined && quote.intradaySeries !== null) {
    if (!Array.isArray(quote.intradaySeries)) {
      return null;
    }
    if (quote.intradaySeries.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
      return null;
    }
  }
  if (!['live', 'delayed', 'end-of-day', 'cached', 'mock', 'unavailable'].includes(String(quote.dataState))) {
    return null;
  }
  if (!isNonEmptyString(quote.provider)) {
    return null;
  }
  if (!isString(value.fetchedAt)) {
    return null;
  }

  const dataState = quote.dataState as MarketQuote['dataState'];
  const providerTimestamp = isString(value.providerTimestamp) || value.providerTimestamp === null
    ? value.providerTimestamp
    : quote.asOf;
  const expiresAt = isString(value.expiresAt) || value.expiresAt === null ? value.expiresAt : null;
  const retryAfterAt = isString(value.retryAfterAt) || value.retryAfterAt === null ? value.retryAfterAt : null;
  const providerId = isNonEmptyString(value.providerId) ? value.providerId : quote.provider;
  if (!isNonEmptyString(providerId)) {
    return null;
  }

  return {
    marketId: value.marketId,
      fetchedAt: value.fetchedAt,
      providerTimestamp: providerTimestamp ?? null,
      expiresAt,
      retryAfterAt,
      providerId,
      quote: {
      marketId: quote.marketId,
      symbol: quote.symbol,
      indexName: quote.indexName,
      value: quote.value,
      previousClose: quote.previousClose,
      absoluteChange: quote.absoluteChange,
      percentageChange: quote.percentageChange,
      dayHigh: quote.dayHigh ?? null,
      dayLow: quote.dayLow ?? null,
      intradaySeries:
        Array.isArray(quote.intradaySeries)
          ? quote.intradaySeries.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
          : null,
      currency: quote.currency,
      asOf: quote.asOf,
      dataState,
      provider: quote.provider,
    } satisfies MarketQuote,
  };
}

function normalizeQuoteCache(value: unknown): QuoteCacheState {
  const fallback = createDefaultQuoteCache();
  if (!isRecord(value)) {
    return fallback;
  }

  const quotes = Array.isArray(value.quotes)
    ? value.quotes.reduce<CachedQuoteEntry[]>((accumulator, entry) => {
        const normalized = normalizeQuoteEntry(entry);
        if (normalized) {
          accumulator.push(normalized);
        }
        return accumulator;
      }, [])
    : fallback.quotes;
  const lastSuccessfulRefreshAt = value.lastSuccessfulRefreshAt === null || isString(value.lastSuccessfulRefreshAt)
    ? value.lastSuccessfulRefreshAt
    : fallback.lastSuccessfulRefreshAt;

  return {
    quotes,
    lastSuccessfulRefreshAt,
  };
}

function normalizePersistedSnapshot(raw: StorageRecord): StorageSnapshot {
  return {
    settingsSchemaVersion: STORAGE_SCHEMA_VERSION,
    settings: normalizeSettings(raw[STORAGE_SETTINGS_KEY] ?? raw.settings).settings,
    quoteCache: normalizeQuoteCache(raw[STORAGE_QUOTE_CACHE_KEY] ?? raw.quoteCache),
  };
}

function toSettingsEnvelope(snapshot: StorageSnapshot): StorageExportEnvelope {
  return {
    schemaVersion: snapshot.settingsSchemaVersion as typeof STORAGE_SCHEMA_VERSION,
    settings: snapshot.settings,
  };
}

function snapshotEquals(left: StorageSnapshot, right: StorageSnapshot): boolean {
  return deepEqual(left, right);
}

function toSettingsValidationErrors(errors: { path: string; message: string }[]): SettingsValidationError[] {
  return errors.map((error) => ({ path: error.path, message: error.message }));
}

function extractSettingsCandidate(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }
  if ('settings' in input && isRecord(input.settings)) {
    return input.settings;
  }
  return input;
}

/**
 * Validate imported JSON before applying it.
 * The returned settings are normalized so malformed optional fields recover safely.
 */
export function validateImportedSettings(input: unknown): SettingsImportResult {
  if (!isRecord(input)) {
    return { valid: false, errors: [{ path: '', message: 'Imported JSON must be an object.' }] };
  }

  const errors: SettingsValidationError[] = [];
  if ('schemaVersion' in input && input.schemaVersion !== undefined && typeof input.schemaVersion !== 'number') {
    errors.push({ path: 'schemaVersion', message: 'schemaVersion must be a number when present.' });
  }
  if ('schemaVersion' in input && typeof input.schemaVersion === 'number' && input.schemaVersion > STORAGE_SCHEMA_VERSION) {
    errors.push({ path: 'schemaVersion', message: 'Imported settings use a newer unsupported schema version.' });
  }

  const candidate = extractSettingsCandidate(input);
  const validation = validateUserSettings(candidate);
  if (!validation.valid) {
    errors.push(...toSettingsValidationErrors(validation.errors));
  }

  if (isRecord(candidate)) {
    const enabledMarketIds = Array.isArray(candidate.enabledMarketIds) ? candidate.enabledMarketIds : [];
    for (const marketId of enabledMarketIds) {
      if (isString(marketId) && !MARKET_DEFINITIONS.some((market) => market.id === marketId)) {
        errors.push({ path: 'enabledMarketIds', message: `Unknown market id "${marketId}".` });
      }
    }

    const marketOrder = Array.isArray(candidate.marketOrder) ? candidate.marketOrder : [];
    for (const marketId of marketOrder) {
      if (isString(marketId) && !MARKET_DEFINITIONS.some((market) => market.id === marketId)) {
        errors.push({ path: 'marketOrder', message: `Unknown market id "${marketId}".` });
      }
    }

    if (isRecord(candidate.providerSymbolOverrides)) {
      for (const [marketId, providerMap] of Object.entries(candidate.providerSymbolOverrides)) {
        if (!MARKET_DEFINITIONS.some((market) => market.id === marketId)) {
          errors.push({ path: 'providerSymbolOverrides', message: `Unknown market id "${marketId}".` });
          continue;
        }
        if (!isRecord(providerMap)) {
          errors.push({
            path: `providerSymbolOverrides.${marketId}`,
            message: 'Provider symbol overrides must be objects.',
          });
          continue;
        }
        for (const [providerId, symbol] of Object.entries(providerMap)) {
          if (!isNonEmptyString(providerId) || !isNonEmptyString(symbol)) {
            errors.push({
              path: `providerSymbolOverrides.${marketId}.${providerId}`,
              message: 'Provider symbol overrides must be non-empty strings.',
            });
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    settings: normalizeSettings(candidate).settings,
  };
}

export class ExtensionStorageController {
  private snapshot: StorageSnapshot = createDefaultSnapshot();

  private readonly listeners = new Set<() => void>();

  private readonly readyPromise: Promise<void>;

  private unsubscribeAdapter: (() => void) | null = null;

  constructor(private readonly adapter: StorageAdapter) {
    this.readyPromise = this.hydrate();
    this.unsubscribeAdapter = this.adapter.subscribe(() => {
      void this.hydrate();
    });
  }

  getSnapshot = (): StorageSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  dispose(): void {
    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;
    this.listeners.clear();
  }

  async hydrate(): Promise<void> {
    const raw = await this.adapter.get([STORAGE_SETTINGS_KEY, STORAGE_QUOTE_CACHE_KEY]);
    this.updateSnapshot(normalizePersistedSnapshot(raw));
  }

  async updateSettings(patch: Partial<UserSettings>): Promise<void> {
    const nextSettings = {
      ...this.snapshot.settings,
      ...patch,
      appearance: {
        ...this.snapshot.settings.appearance,
        ...patch.appearance,
      },
      dataProvider: {
        ...this.snapshot.settings.dataProvider,
        ...patch.dataProvider,
      },
    };

    const nextSnapshot: StorageSnapshot = {
      ...this.snapshot,
      settingsSchemaVersion: STORAGE_SCHEMA_VERSION,
      settings: normalizeSettings(nextSettings).settings,
    };
    await this.persistSnapshot(nextSnapshot, { updateSettings: true });
  }

  async setSettings(settings: UserSettings): Promise<void> {
    const nextSnapshot: StorageSnapshot = {
      ...this.snapshot,
      settingsSchemaVersion: STORAGE_SCHEMA_VERSION,
      settings: normalizeSettings(settings).settings,
    };
    await this.persistSnapshot(nextSnapshot, { updateSettings: true });
  }

  async setQuoteCache(quoteCache: QuoteCacheState): Promise<void> {
    const nextSnapshot: StorageSnapshot = {
      ...this.snapshot,
      quoteCache: normalizeQuoteCache(quoteCache),
    };
    await this.persistSnapshot(nextSnapshot, { updateQuoteCache: true });
  }

  async clearQuoteCache(): Promise<void> {
    const nextSnapshot: StorageSnapshot = {
      ...this.snapshot,
      quoteCache: createDefaultQuoteCache(),
    };
    await this.persistSnapshot(nextSnapshot, { removeQuoteCache: true });
  }

  async resetPreferences(): Promise<void> {
    const nextSnapshot: StorageSnapshot = {
      ...this.snapshot,
      settingsSchemaVersion: STORAGE_SCHEMA_VERSION,
      settings: createDefaultSettings(),
    };
    await this.persistSnapshot(nextSnapshot, { updateSettings: true });
  }

  async clearAllExtensionData(): Promise<void> {
    await this.adapter.clear();
    this.updateSnapshot(createDefaultSnapshot());
  }

  exportSettings(includeSecrets = false): string {
    const settings = includeSecrets
      ? this.snapshot.settings
      : {
          ...this.snapshot.settings,
          dataProvider: {
            ...this.snapshot.settings.dataProvider,
            apiKey: null,
          },
        };

    const envelope: StorageExportEnvelope = {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      settings,
    };
    return JSON.stringify(envelope, null, 2);
  }

  async importSettingsJson(jsonText: string): Promise<SettingsImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { valid: false, errors: [{ path: '', message: 'Import JSON is not valid JSON.' }] };
    }

    const validation = validateImportedSettings(parsed);
    if (!validation.valid || !validation.settings) {
      return { valid: false, errors: validation.errors };
    }

    await this.setSettings(validation.settings);
    return validation;
  }

  private updateSnapshot(next: StorageSnapshot): void {
    if (snapshotEquals(this.snapshot, next)) {
      return;
    }
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async persistSnapshot(
    snapshot: StorageSnapshot,
    options: { updateSettings?: boolean; updateQuoteCache?: boolean; removeQuoteCache?: boolean },
  ): Promise<void> {
    const items: StorageRecord = {};
    if (options.updateSettings) {
      items[STORAGE_SETTINGS_KEY] = toSettingsEnvelope(snapshot);
    }
    if (options.updateQuoteCache) {
      items[STORAGE_QUOTE_CACHE_KEY] = clone(snapshot.quoteCache);
    }
    if (Object.keys(items).length > 0) {
      await this.adapter.set(items);
    }
    if (options.removeQuoteCache) {
      await this.adapter.remove(STORAGE_QUOTE_CACHE_KEY);
    }
    this.updateSnapshot(snapshot);
  }
}

function createMemoryMap(initial?: StorageRecord): StorageRecord {
  return initial ? clone(initial) : {};
}

export class MemoryStorageAdapter implements StorageAdapter {
  private store: StorageRecord;

  private readonly listeners = new Set<(changes: StorageAdapterChangeMap) => void>();

  constructor(initial?: StorageRecord) {
    this.store = createMemoryMap(initial);
  }

  async get(keys?: string[] | null): Promise<Record<string, unknown>> {
    if (!keys) {
      return clone(this.store);
    }
    return keys.reduce<Record<string, unknown>>((accumulator, key) => {
      if (key in this.store) {
        accumulator[key] = clone(this.store[key]);
      }
      return accumulator;
    }, {});
  }

  async set(items: Record<string, unknown>): Promise<void> {
    const changes: StorageAdapterChangeMap = {};
    for (const [key, value] of Object.entries(items)) {
      changes[key] = {
        oldValue: key in this.store ? clone(this.store[key]) : undefined,
        newValue: clone(value),
      };
      this.store[key] = clone(value);
    }
    this.emit(changes);
  }

  async remove(keys: string[] | string): Promise<void> {
    const keysToRemove = Array.isArray(keys) ? keys : [keys];
    const changes: StorageAdapterChangeMap = {};
    for (const key of keysToRemove) {
      if (!(key in this.store)) {
        continue;
      }
      changes[key] = {
        oldValue: clone(this.store[key]),
        newValue: undefined,
      };
      delete this.store[key];
    }
    this.emit(changes);
  }

  async clear(): Promise<void> {
    const changes: StorageAdapterChangeMap = {};
    for (const [key, value] of Object.entries(this.store)) {
      changes[key] = {
        oldValue: clone(value),
        newValue: undefined,
      };
    }
    this.store = {};
    this.emit(changes);
  }

  subscribe(listener: (changes: StorageAdapterChangeMap) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): StorageRecord {
    return clone(this.store);
  }

  private emit(changes: StorageAdapterChangeMap): void {
    if (Object.keys(changes).length === 0) {
      return;
    }
    for (const listener of this.listeners) {
      listener(clone(changes));
    }
  }
}

export function createMemoryStorageAdapter(initial?: StorageRecord): MemoryStorageAdapter {
  return new MemoryStorageAdapter(initial);
}

export function createChromeStorageAdapter(): StorageAdapter {
  if (typeof chrome === 'undefined' || !chrome.storage?.local || !chrome.storage?.onChanged) {
    return createMemoryStorageAdapter();
  }

  return {
    async get(keys?: string[] | null): Promise<Record<string, unknown>> {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys ?? null, (items) => {
          resolve(items as Record<string, unknown>);
        });
      });
    },
    async set(items: Record<string, unknown>): Promise<void> {
      chrome.storage.local.set(items);
    },
    async remove(keys: string[] | string): Promise<void> {
      chrome.storage.local.remove(keys);
    },
    async clear(): Promise<void> {
      chrome.storage.local.clear();
    },
    subscribe(listener: (changes: StorageAdapterChangeMap) => void): () => void {
      const callback = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: 'session' | 'sync' | 'local' | 'managed',
      ) => {
        if (areaName === 'local') {
          const normalized: StorageAdapterChangeMap = {};
          for (const [key, change] of Object.entries(changes)) {
            normalized[key] = {
              oldValue: change.oldValue,
              newValue: change.newValue,
            };
          }
          listener(normalized);
        }
      };
      chrome.storage.onChanged.addListener(callback);
      return () => chrome.storage.onChanged.removeListener(callback);
    },
  };
}

const defaultController = new ExtensionStorageController(createChromeStorageAdapter());

export function getDefaultStorageController(): ExtensionStorageController {
  return defaultController;
}

export function exportSettingsToJson(includeSecrets = false): string {
  return defaultController.exportSettings(includeSecrets);
}

export async function importSettingsFromJson(jsonText: string): Promise<SettingsImportResult> {
  return defaultController.importSettingsJson(jsonText);
}

export async function clearQuoteCache(): Promise<void> {
  await defaultController.clearQuoteCache();
}

export async function resetPreferences(): Promise<void> {
  await defaultController.resetPreferences();
}

export async function clearAllExtensionData(): Promise<void> {
  await defaultController.clearAllExtensionData();
}
