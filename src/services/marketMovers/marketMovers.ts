import { formatDistanceStrict } from 'date-fns';
import type {
  MarketDefinition,
  MarketMoversSnapshot,
  MarketMoverDefinition,
  MarketMoverKind,
  MarketMoverUniverse,
  MarketClockState,
  ProviderCapabilities,
} from '../../domain/market';
import {
  MarketDataError,
  type MarketDataProvider,
} from '../marketData/marketData';
import type { StorageAdapter } from '../storage/extensionStorage';

export const STORAGE_MARKET_MOVERS_KEY = 'market-window.market-movers';
export const MOVERS_OPEN_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const MOVERS_BREAK_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const MOVERS_CLOSED_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const MOVERS_FAILURE_BACKOFF_MS = 12 * 60 * 60 * 1000;

export type MarketMoversStatus = 'ready' | 'stale' | 'rate_limited' | 'unsupported';

export interface MarketMoversCacheEntry {
  marketId: string;
  snapshot: MarketMoversSnapshot;
  fetchedAt: string;
  providerTimestamp: string | null;
  expiresAt: string | null;
  retryAfterAt: string | null;
  providerId: string;
  universe: MarketMoverUniverse;
}

export interface MarketMoversCacheState {
  entries: MarketMoversCacheEntry[];
  lastSuccessfulRefreshAt: string | null;
}

export interface MarketMoversRefreshResult {
  marketId: string;
  status: 'updated' | 'cached' | 'skipped' | 'failed' | 'rate_limited' | 'unsupported';
  snapshot: MarketMoversSnapshot | null;
  entry: MarketMoversCacheEntry | null;
  stale: boolean;
  error: MarketDataError | null;
}

export interface MarketMoversPanelCard {
  kind: MarketMoverKind;
  label: string;
  symbol: string;
  name: string;
  valueLabel: string;
  absoluteChangeLabel: string;
  percentageChangeLabel: string;
  tone: 'positive' | 'negative' | 'neutral';
  dataStateLabel: MarketMoversSnapshot['dataState'];
}

export interface MarketMoversPanelModel {
  visible: boolean;
  status: MarketMoversStatus;
  universeLabel: string | null;
  marketLabel: string;
  providerLabel: string;
  cacheAgeLabel: string | null;
  staleLabel: string | null;
  rateLimitLabel: string | null;
  cards: MarketMoversPanelCard[];
  errorLabel: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatSignedNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  })}`;
}

function formatSignedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${Math.abs(value).toFixed(2)}%`;
}

function formatValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'Data unavailable';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getIntervalForState(state: MarketClockState['state']): number {
  switch (state) {
    case 'open':
    case 'pre-market':
      return MOVERS_OPEN_REFRESH_INTERVAL_MS;
    case 'lunch-break':
      return MOVERS_BREAK_REFRESH_INTERVAL_MS;
    case 'closed':
    case 'weekend':
    case 'holiday':
      return MOVERS_CLOSED_REFRESH_INTERVAL_MS;
    default:
      return MOVERS_OPEN_REFRESH_INTERVAL_MS;
  }
}

function getUniverseLabel(universe: MarketMoverUniverse): string {
  switch (universe) {
    case 'exchange':
      return 'Exchange-wide movers';
    case 'index-constituents':
      return 'Index-constituent movers';
    case 'provider-defined':
      return 'Provider-defined movers';
  }
}

function getMoverLabel(kind: MarketMoverKind): string {
  switch (kind) {
    case 'largest_percentage_gainer':
      return 'Largest percentage gainer';
    case 'largest_percentage_loser':
      return 'Largest percentage loser';
    case 'largest_absolute_percentage_move':
      return 'Largest absolute percentage move';
  }
}

function getCacheAgeLabel(entry: MarketMoversCacheEntry | null, now: Date): string | null {
  if (!entry) {
    return null;
  }
  const fetchedAt = toDate(entry.fetchedAt);
  if (!fetchedAt) {
    return null;
  }
  return `Cached ${formatDistanceStrict(fetchedAt, now, { addSuffix: true })}`;
}

function computeExpiryAt(state: MarketClockState, fetchedAt: Date): Date {
  return new Date(fetchedAt.getTime() + getIntervalForState(state.state));
}

function normalizeMover(value: unknown): MarketMoverDefinition | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.kind !== 'largest_percentage_gainer' &&
    value.kind !== 'largest_percentage_loser' &&
    value.kind !== 'largest_absolute_percentage_move'
  ) {
    return null;
  }
  if (!isNonEmptyString(value.symbol) || !isNonEmptyString(value.name)) {
    return null;
  }
  if (
    (value.value !== null && typeof value.value !== 'number') ||
    (value.previousClose !== null && typeof value.previousClose !== 'number') ||
    (value.absoluteChange !== null && typeof value.absoluteChange !== 'number') ||
    (value.percentageChange !== null && typeof value.percentageChange !== 'number') ||
    (value.asOf !== null && typeof value.asOf !== 'string')
  ) {
    return null;
  }
  if (value.dataState !== 'live' && value.dataState !== 'delayed' && value.dataState !== 'end-of-day' && value.dataState !== 'cached' && value.dataState !== 'mock' && value.dataState !== 'unavailable') {
    return null;
  }

  return {
    kind: value.kind,
    symbol: value.symbol,
    name: value.name,
    value: value.value,
    previousClose: value.previousClose,
    absoluteChange: value.absoluteChange,
    percentageChange: value.percentageChange,
    asOf: value.asOf,
    dataState: value.dataState,
  };
}

function normalizeSnapshot(value: unknown): MarketMoversCacheState {
  if (!isRecord(value)) {
    return {
      entries: [],
      lastSuccessfulRefreshAt: null,
    };
  }

  const entries = Array.isArray(value.entries)
    ? value.entries.reduce<MarketMoversCacheEntry[]>((accumulator, entry) => {
        if (!isRecord(entry)) {
          return accumulator;
        }
        if (!isNonEmptyString(entry.marketId) || !isRecord(entry.snapshot)) {
          return accumulator;
        }
        const snapshot = entry.snapshot as Record<string, unknown>;
        if (
          !isNonEmptyString(snapshot.marketId) ||
          !isNonEmptyString(snapshot.indexName) ||
          !isNonEmptyString(snapshot.provider) ||
          !isNonEmptyString(snapshot.universe) ||
          !Array.isArray(snapshot.movers)
        ) {
          return accumulator;
        }
        const movers = snapshot.movers.map(normalizeMover).filter((mover): mover is MarketMoverDefinition => mover !== null);
        const normalizedUniverse = snapshot.universe as MarketMoverUniverse;
        const fetchedAt = isString(entry.fetchedAt) ? entry.fetchedAt : null;
        if (!fetchedAt) {
          return accumulator;
        }
        accumulator.push({
          marketId: entry.marketId,
          snapshot: {
            marketId: snapshot.marketId,
            indexName: snapshot.indexName,
            provider: snapshot.provider,
            universe: normalizedUniverse,
            dataState:
              snapshot.dataState === 'live' ||
              snapshot.dataState === 'delayed' ||
              snapshot.dataState === 'end-of-day' ||
              snapshot.dataState === 'cached' ||
              snapshot.dataState === 'mock' ||
              snapshot.dataState === 'unavailable'
                ? snapshot.dataState
                : 'unavailable',
            asOf: typeof snapshot.asOf === 'string' || snapshot.asOf === null ? snapshot.asOf : null,
            movers,
          },
          fetchedAt,
          providerTimestamp: typeof entry.providerTimestamp === 'string' || entry.providerTimestamp === null ? entry.providerTimestamp : null,
          expiresAt: typeof entry.expiresAt === 'string' || entry.expiresAt === null ? entry.expiresAt : null,
          retryAfterAt: typeof entry.retryAfterAt === 'string' || entry.retryAfterAt === null ? entry.retryAfterAt : null,
          providerId: isNonEmptyString(entry.providerId) ? entry.providerId : snapshot.provider,
          universe: normalizedUniverse,
        });
        return accumulator;
      }, [])
    : [];

  return {
    entries,
    lastSuccessfulRefreshAt: typeof value.lastSuccessfulRefreshAt === 'string' || value.lastSuccessfulRefreshAt === null ? value.lastSuccessfulRefreshAt : null,
  };
}

function isSupportedUniverse(capabilities: ProviderCapabilities, market: MarketDefinition): market is MarketDefinition & { moverCoverage: { supportedUniverses: MarketMoverUniverse[] } } {
  if (!capabilities.marketMovers || capabilities.moverUniverse === 'unsupported') {
    return false;
  }
  const coverage = market.moverCoverage?.supportedUniverses ?? [];
  return coverage.includes(capabilities.moverUniverse);
}

function isBlockedByRetry(entry: MarketMoversCacheEntry | null, now: Date): boolean {
  if (!entry?.retryAfterAt) {
    return false;
  }
  const retryAfterAt = toDate(entry.retryAfterAt);
  return retryAfterAt ? now.getTime() < retryAfterAt.getTime() : false;
}

export function isMarketMoversEntryStale(entry: MarketMoversCacheEntry | null, marketState: MarketClockState, now: Date): boolean {
  if (marketState.state === 'unknown') {
    return true;
  }
  if (!entry || !entry.expiresAt) {
    return true;
  }
  const expiresAt = toDate(entry.expiresAt);
  if (!expiresAt) {
    return true;
  }
  return now.getTime() >= expiresAt.getTime();
}

export function createMarketMoversUnavailableSnapshot(
  market: MarketDefinition,
  provider: MarketDataProvider,
): MarketMoversSnapshot {
  return {
    marketId: market.id,
    indexName: market.indexName,
    provider: provider.id,
    universe: provider.capabilities.moverUniverse === 'unsupported' ? 'provider-defined' : provider.capabilities.moverUniverse,
    dataState: 'unavailable',
    asOf: null,
    movers: [],
  };
}

export function buildMarketMoversPanelModel(options: {
  market: MarketDefinition;
  marketState: MarketClockState;
  provider: MarketDataProvider;
  entry: MarketMoversCacheEntry | null;
  now: Date;
  refreshError?: MarketDataError | null;
}): MarketMoversPanelModel | null {
  if (!isSupportedUniverse(options.provider.capabilities, options.market)) {
    return null;
  }

  const stale = isMarketMoversEntryStale(options.entry, options.marketState, options.now);
  const rateLimited = options.refreshError?.code === 'rate_limited';
  const universe =
    options.entry?.universe ??
    (options.provider.capabilities.moverUniverse === 'unsupported' ? 'provider-defined' : options.provider.capabilities.moverUniverse);
  const universeLabel = getUniverseLabel(universe);
  const cacheAgeLabel = getCacheAgeLabel(options.entry, options.now);

  if (rateLimited) {
    return {
      visible: true,
      status: 'rate_limited',
      universeLabel,
      marketLabel: `${options.market.exchangeCode} movers`,
      providerLabel: options.provider.id,
      cacheAgeLabel,
      staleLabel: null,
      rateLimitLabel: 'Rate limit reached. Movers stay hidden until the next allowed refresh window.',
      cards: [],
      errorLabel: options.refreshError?.message ?? 'Rate limit reached.',
    };
  }

  if (stale) {
    return {
      visible: true,
      status: 'stale',
      universeLabel,
      marketLabel: `${options.market.exchangeCode} movers`,
      providerLabel: options.provider.id,
      cacheAgeLabel,
      staleLabel: 'Mover data is stale and hidden until a fresh response arrives.',
      rateLimitLabel: null,
      cards: [],
      errorLabel: null,
    };
  }

  const snapshot = options.entry?.snapshot;
  if (!snapshot) {
    return null;
  }

  return {
    visible: true,
    status: 'ready',
    universeLabel,
    marketLabel: `${options.market.exchangeCode} movers`,
    providerLabel: options.provider.id,
    cacheAgeLabel,
    staleLabel: null,
    rateLimitLabel: null,
    cards: snapshot.movers.map((mover) => ({
      kind: mover.kind,
      label: getMoverLabel(mover.kind),
      symbol: mover.symbol,
      name: mover.name,
      valueLabel: formatValue(mover.value),
      absoluteChangeLabel: formatSignedNumber(mover.absoluteChange),
      percentageChangeLabel: formatSignedPercent(mover.percentageChange),
      tone:
        mover.percentageChange === null
          ? 'neutral'
          : mover.percentageChange > 0
            ? 'positive'
            : mover.percentageChange < 0
              ? 'negative'
              : 'neutral',
      dataStateLabel: mover.dataState,
    })),
    errorLabel: null,
  };
}

export class MarketMoversCacheService {
  private readonly inFlight = new Map<string, Promise<MarketMoversRefreshResult>>();
  private readonly readyPromise: Promise<void>;
  private snapshot: MarketMoversCacheState = {
    entries: [],
    lastSuccessfulRefreshAt: null,
  };
  private writeQueue: Promise<void> = Promise.resolve();
  private unsubscribeAdapter: (() => void) | null = null;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly providers: Record<string, MarketDataProvider>,
  ) {
    this.readyPromise = this.hydrate();
    this.unsubscribeAdapter = this.storage.subscribe(() => {
      void this.hydrate();
    });
  }

  getSnapshot(): MarketMoversCacheState {
    return this.snapshot;
  }

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  dispose(): void {
    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;
  }

  private async hydrate(): Promise<void> {
    const raw = await this.storage.get([STORAGE_MARKET_MOVERS_KEY]);
    this.snapshot = normalizeSnapshot(raw[STORAGE_MARKET_MOVERS_KEY]);
  }

  private async writeSnapshot(snapshot: MarketMoversCacheState): Promise<void> {
    await this.storage.set({ [STORAGE_MARKET_MOVERS_KEY]: snapshot });
    this.snapshot = snapshot;
  }

  private enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task);
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  getEntry(marketId: string): MarketMoversCacheEntry | null {
    return this.getSnapshot().entries.find((entry) => entry.marketId === marketId) ?? null;
  }

  isStale(marketId: string, marketState: MarketClockState, now: Date): boolean {
    return isMarketMoversEntryStale(this.getEntry(marketId), marketState, now);
  }

  async refreshMovers(options: {
    market: MarketDefinition;
    marketState: MarketClockState;
    providerId: string;
    apiKey: string;
    now: Date;
  }): Promise<MarketMoversRefreshResult> {
    const provider = this.providers[options.providerId];
    if (!provider || !isSupportedUniverse(provider.capabilities, options.market)) {
      return {
        marketId: options.market.id,
        status: 'unsupported',
        snapshot: null,
        entry: this.getEntry(options.market.id),
        stale: false,
        error: null,
      };
    }

    const currentEntry = this.getEntry(options.market.id);
    const stale = isMarketMoversEntryStale(currentEntry, options.marketState, options.now);
    if (currentEntry && isBlockedByRetry(currentEntry, options.now)) {
      return {
        marketId: options.market.id,
        status: stale ? 'cached' : 'skipped',
        snapshot: currentEntry.snapshot,
        entry: currentEntry,
        stale,
        error: null,
      };
    }
    if (!stale) {
      return {
        marketId: options.market.id,
        status: 'cached',
        snapshot: currentEntry?.snapshot ?? null,
        entry: currentEntry,
        stale: false,
        error: null,
      };
    }

    const dedupeKey = `${provider.id}:${options.market.id}`;
    const inFlight = this.inFlight.get(dedupeKey);
    if (inFlight) {
      return inFlight;
    }

    const promise = this.refreshMarket({
      market: options.market,
      marketState: options.marketState,
      provider,
      apiKey: options.apiKey,
      now: options.now,
      currentEntry,
    }).finally(() => {
      this.inFlight.delete(dedupeKey);
    });

    this.inFlight.set(dedupeKey, promise);
    return promise;
  }

  private async refreshMarket(options: {
    market: MarketDefinition;
    marketState: MarketClockState;
    provider: MarketDataProvider;
    apiKey: string;
    now: Date;
    currentEntry: MarketMoversCacheEntry | null;
  }): Promise<MarketMoversRefreshResult> {
    if (!options.provider.fetchMovers) {
      return {
        marketId: options.market.id,
        status: 'unsupported',
        snapshot: null,
        entry: options.currentEntry,
        stale: true,
        error: null,
      };
    }

    try {
      const snapshot = await options.provider.fetchMovers(options.market, options.apiKey);
      const fetchedAt = options.now.toISOString();
      const expiresAt = computeExpiryAt(options.marketState, options.now).toISOString();
      const entry: MarketMoversCacheEntry = {
        marketId: options.market.id,
        snapshot,
        fetchedAt,
        providerTimestamp: snapshot.asOf,
        expiresAt,
        retryAfterAt: null,
        providerId: options.provider.id,
        universe: snapshot.universe,
      };

      await this.enqueueWrite(async () => {
        const current = this.snapshot;
        const nextEntries = current.entries.filter((candidate) => candidate.marketId !== options.market.id);
        nextEntries.push(entry);
        const nextSnapshot = {
          entries: nextEntries,
          lastSuccessfulRefreshAt: fetchedAt,
        };
        await this.writeSnapshot(nextSnapshot);
      });

      return {
        marketId: options.market.id,
        status: 'updated',
        snapshot,
        entry,
        stale: false,
        error: null,
      };
    } catch (error) {
      const marketError = error instanceof MarketDataError ? error : new MarketDataError('unknown_error', 'Unknown mover failure.');
      const retryAfterAt = new Date(options.now.getTime() + MOVERS_FAILURE_BACKOFF_MS).toISOString();
      const failedEntry: MarketMoversCacheEntry = options.currentEntry
        ? { ...options.currentEntry, retryAfterAt }
        : {
            marketId: options.market.id,
            snapshot: createMarketMoversUnavailableSnapshot(options.market, options.provider),
            fetchedAt: options.now.toISOString(),
            providerTimestamp: null,
            expiresAt: retryAfterAt,
            retryAfterAt,
            providerId: options.provider.id,
            universe: options.provider.capabilities.moverUniverse === 'unsupported' ? 'provider-defined' : options.provider.capabilities.moverUniverse,
          };

      await this.enqueueWrite(async () => {
        const current = this.snapshot;
        const nextEntries = current.entries.filter((candidate) => candidate.marketId !== options.market.id);
        nextEntries.push(failedEntry);
        const nextSnapshot = {
          entries: nextEntries,
          lastSuccessfulRefreshAt: current.lastSuccessfulRefreshAt,
        };
        await this.writeSnapshot(nextSnapshot);
      });

      return {
        marketId: options.market.id,
        status: marketError.code === 'rate_limited' ? 'rate_limited' : 'failed',
        snapshot: options.currentEntry?.snapshot ?? failedEntry.snapshot,
        entry: failedEntry,
        stale: true,
        error: marketError,
      };
    }
  }

}

export function isMoversModuleSupported(provider: MarketDataProvider, market: MarketDefinition): boolean {
  return isSupportedUniverse(provider.capabilities, market);
}

export function describeMoverUniverse(universe: ProviderCapabilities['moverUniverse']): string {
  return getUniverseLabel(universe === 'unsupported' ? 'provider-defined' : universe);
}
