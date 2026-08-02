import type { MarketDefinition, MarketQuote } from '../../domain/market';
import type { MarketClockState } from '../../domain/market';
import {
  type CachedQuoteEntry,
  type ExtensionStorageController,
  type QuoteCacheState,
  createDefaultQuoteCache,
} from '../storage/extensionStorage';
import {
  createMarketQuote,
  resolveMarketProviderSymbol,
  withProviderSymbolOverride,
  MarketDataError,
  type MarketDataProvider,
  type ProviderSymbolOverrideMap,
} from './marketData';

export const OPEN_MARKET_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
export const BREAK_MARKET_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
export const CLOSED_MARKET_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
export const POST_CLOSE_REFRESH_GRACE_MS = 5 * 60 * 1000;
export const REFRESH_FAILURE_BACKOFF_MS = 15 * 60 * 1000;

export type QuoteRefreshStatus = 'updated' | 'cached' | 'skipped' | 'failed';

export interface QuoteRefreshResult {
  marketId: string;
  status: QuoteRefreshStatus;
  quote: MarketQuote | null;
  entry: CachedQuoteEntry | null;
  stale: boolean;
  error: MarketDataError | null;
}

export interface SymbolValidationResult {
  marketId: string;
  providerId: string;
  symbol: string | null;
  valid: boolean;
  message: string | null;
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getFailureBackoffForState(state: MarketClockState['state']): number {
  switch (state) {
    case 'open':
    case 'pre-market':
      return REFRESH_FAILURE_BACKOFF_MS;
    case 'lunch-break':
      return BREAK_MARKET_REFRESH_INTERVAL_MS;
    case 'closed':
    case 'weekend':
    case 'holiday':
      return CLOSED_MARKET_REFRESH_INTERVAL_MS;
    default:
      return REFRESH_FAILURE_BACKOFF_MS;
  }
}

function getIntervalForState(state: MarketClockState['state']): number {
  switch (state) {
    case 'open':
    case 'pre-market':
      return OPEN_MARKET_REFRESH_INTERVAL_MS;
    case 'lunch-break':
      return BREAK_MARKET_REFRESH_INTERVAL_MS;
    case 'closed':
    case 'weekend':
    case 'holiday':
      return CLOSED_MARKET_REFRESH_INTERVAL_MS;
    default:
      return OPEN_MARKET_REFRESH_INTERVAL_MS;
  }
}

export function computeQuoteExpiryAt(
  marketState: MarketClockState,
  fetchedAt: Date,
  providerState: MarketQuote['dataState'],
): Date {
  const intervalMs = getIntervalForState(marketState.state);
  const intervalExpiry = new Date(fetchedAt.getTime() + intervalMs);
  const nextTransitionAt = toDate(marketState.nextTransitionAt);

  if (marketState.state === 'open' && nextTransitionAt) {
    return new Date(Math.min(intervalExpiry.getTime(), nextTransitionAt.getTime() + POST_CLOSE_REFRESH_GRACE_MS));
  }
  if ((marketState.state === 'closed' || marketState.state === 'weekend' || marketState.state === 'holiday') && nextTransitionAt) {
    return new Date(Math.min(intervalExpiry.getTime(), nextTransitionAt.getTime()));
  }
  if (marketState.state === 'lunch-break' && nextTransitionAt) {
    return new Date(Math.min(intervalExpiry.getTime(), nextTransitionAt.getTime()));
  }

  if (providerState === 'mock') {
    return intervalExpiry;
  }

  return intervalExpiry;
}

export function isQuoteCacheEntryStale(
  entry: CachedQuoteEntry | null,
  marketState: MarketClockState,
  now: Date,
): boolean {
  if (!entry || !entry.expiresAt) {
    return true;
  }
  const expiresAt = new Date(entry.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return true;
  }
  return now.getTime() >= expiresAt.getTime();
}

function isRefreshBlocked(entry: CachedQuoteEntry | null, now: Date): boolean {
  if (!entry?.retryAfterAt) {
    return false;
  }
  const retryAfterAt = new Date(entry.retryAfterAt);
  if (Number.isNaN(retryAfterAt.getTime())) {
    return false;
  }
  return now.getTime() < retryAfterAt.getTime();
}

export function createUnavailableQuote(market: MarketDefinition, providerId: string): MarketQuote {
  return createMarketQuote({
    marketId: market.id,
    symbol: resolveMarketProviderSymbol(market, providerId) ?? 'unavailable',
    indexName: market.indexName,
    value: null,
    previousClose: null,
    absoluteChange: null,
    percentageChange: null,
    currency: null,
    asOf: null,
    dataState: 'unavailable',
    provider: providerId,
  });
}

export function getCacheEntryByMarketId(cache: QuoteCacheState, marketId: string): CachedQuoteEntry | null {
  return cache.quotes.find((entry) => entry.marketId === marketId) ?? null;
}

export class MarketQuoteCacheService {
  private readonly inFlight = new Map<string, Promise<QuoteRefreshResult>>();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: ExtensionStorageController,
    private readonly providers: Record<string, MarketDataProvider>,
  ) {}

  getSnapshot(): QuoteCacheState {
    return this.storage.getSnapshot().quoteCache;
  }

  getEntry(marketId: string): CachedQuoteEntry | null {
    return getCacheEntryByMarketId(this.getSnapshot(), marketId);
  }

  private enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task);
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async fetchDemoFallbackQuote(market: MarketDefinition, currentProviderId: string): Promise<MarketQuote | null> {
    const demoProvider = this.providers.mock;
    if (!demoProvider || demoProvider.id === currentProviderId) {
      return null;
    }

    try {
      return await demoProvider.fetchQuote(market, '');
    } catch {
      return null;
    }
  }

  isStale(marketId: string, marketState: MarketClockState, now: Date): boolean {
    return isQuoteCacheEntryStale(this.getEntry(marketId), marketState, now);
  }

  async validateConfiguredSymbols(
    markets: MarketDefinition[],
    providerId: string,
    apiKey: string,
    overrides: ProviderSymbolOverrideMap = {},
  ): Promise<SymbolValidationResult[]> {
    const provider = this.providers[providerId];
    if (!provider) {
      return markets.map((market) => ({
        marketId: market.id,
        providerId,
        symbol: null,
        valid: false,
        message: `Provider "${providerId}" is not available.`,
      }));
    }

    const results = await Promise.all(
      markets.map(async (market) => {
        const symbol = resolveMarketProviderSymbol(market, provider.id, overrides);
        if (!symbol) {
          return {
            marketId: market.id,
            providerId: provider.id,
            symbol: null,
            valid: false,
            message: `No symbol configured for ${market.exchangeCode}.`,
          } satisfies SymbolValidationResult;
        }

        try {
          const marketWithSymbol = withProviderSymbolOverride(market, provider.id, symbol);
          await provider.fetchQuote(marketWithSymbol, apiKey);
          return {
            marketId: market.id,
            providerId: provider.id,
            symbol,
            valid: true,
            message: null,
          } satisfies SymbolValidationResult;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown symbol validation failure.';
          return {
            marketId: market.id,
            providerId: provider.id,
            symbol,
            valid: false,
            message,
          } satisfies SymbolValidationResult;
        }
      }),
    );

    return results;
  }

  async refreshQuotes(options: {
    markets: MarketDefinition[];
    marketStates: Record<string, MarketClockState>;
    providerId: string;
    apiKey: string;
    now: Date;
    overrides?: ProviderSymbolOverrideMap;
  }): Promise<QuoteRefreshResult[]> {
    const provider = this.providers[options.providerId] ?? this.providers.mock;
    const effectiveProviderId = provider.id;
    const results = await Promise.all(
      options.markets.map(async (market) => {
        const state = options.marketStates[market.id];
        if (!state) {
          return {
            marketId: market.id,
            status: 'skipped',
            quote: null,
            entry: this.getEntry(market.id),
            stale: false,
            error: null,
          } satisfies QuoteRefreshResult;
        }

        const currentEntry = this.getEntry(market.id);
        const shouldForceDemoRefresh =
          provider.id === 'mock' && currentEntry?.quote.dataState !== 'mock';
        const stale = shouldForceDemoRefresh || isQuoteCacheEntryStale(currentEntry, state, options.now);
        if (currentEntry && isRefreshBlocked(currentEntry, options.now)) {
          return {
            marketId: market.id,
            status: stale ? 'cached' : 'skipped',
            quote: currentEntry.quote,
            entry: currentEntry,
            stale,
            error: null,
          } satisfies QuoteRefreshResult;
        }
        if (!stale) {
          return {
            marketId: market.id,
            status: 'cached',
            quote: currentEntry?.quote ?? null,
            entry: currentEntry,
            stale: false,
            error: null,
          } satisfies QuoteRefreshResult;
        }

        const symbol = resolveMarketProviderSymbol(market, effectiveProviderId, options.overrides);
        if (!symbol) {
          const unavailableQuote = createUnavailableQuote(market, effectiveProviderId);
          return {
            marketId: market.id,
            status: 'failed',
            quote: unavailableQuote,
            entry: currentEntry,
            stale: true,
            error: new MarketDataError('symbol_unavailable', `No symbol configured for ${market.exchangeCode}.`),
          } satisfies QuoteRefreshResult;
        }

        const dedupeKey = `${effectiveProviderId}:${market.id}:${symbol}`;
        const inFlight = this.inFlight.get(dedupeKey);
        if (inFlight) {
          return inFlight;
        }

        const promise = this.refreshMarket({
          market,
          provider,
          apiKey: options.apiKey,
          marketState: state,
          now: options.now,
          symbol,
          currentEntry,
        }).finally(() => {
          this.inFlight.delete(dedupeKey);
        });

        this.inFlight.set(dedupeKey, promise);
        return promise;
      }),
    );

    return results;
  }

  private async refreshMarket(options: {
    market: MarketDefinition;
    provider: MarketDataProvider;
    apiKey: string;
    marketState: MarketClockState;
    now: Date;
    symbol: string;
    currentEntry: CachedQuoteEntry | null;
  }): Promise<QuoteRefreshResult> {
    const marketWithSymbol = withProviderSymbolOverride(options.market, options.provider.id, options.symbol);

    try {
      let quote = await options.provider.fetchQuote(marketWithSymbol, options.apiKey);
      if (
        options.provider.id !== 'mock' &&
        (quote.dataState === 'unavailable' || quote.value === null || quote.asOf === null)
      ) {
        const demoQuote = await this.fetchDemoFallbackQuote(options.market, options.provider.id);
        if (demoQuote) {
          quote = demoQuote;
        }
      }
      const fetchedAt = options.now.toISOString();
      const expiresAt = computeQuoteExpiryAt(options.marketState, options.now, quote.dataState).toISOString();
      const entry: CachedQuoteEntry = {
        marketId: options.market.id,
        quote,
        fetchedAt,
        providerTimestamp: quote.asOf,
        expiresAt,
        retryAfterAt: null,
        providerId: options.provider.id,
      };

      await this.enqueueWrite(async () => {
        const current = this.getSnapshot();
        const nextQuotes = current.quotes.filter((candidate) => candidate.marketId !== options.market.id);
        nextQuotes.push(entry);
        await this.storage.setQuoteCache({
          quotes: nextQuotes,
          lastSuccessfulRefreshAt: fetchedAt,
        });
      });

      return {
        marketId: options.market.id,
        status: 'updated',
        quote,
        entry,
        stale: false,
        error: null,
      };
    } catch (error) {
      if (error instanceof MarketDataError) {
        const marketDataError = error;
        const demoQuote = await this.fetchDemoFallbackQuote(options.market, options.provider.id);
        if (demoQuote) {
          const fetchedAt = options.now.toISOString();
          const expiresAt = computeQuoteExpiryAt(options.marketState, options.now, demoQuote.dataState).toISOString();
          const demoEntry: CachedQuoteEntry = {
            marketId: options.market.id,
            quote: demoQuote,
            fetchedAt,
            providerTimestamp: demoQuote.asOf,
            expiresAt,
            retryAfterAt: null,
            providerId: demoQuote.provider,
          };

          await this.enqueueWrite(async () => {
            const current = this.getSnapshot();
            const nextQuotes = current.quotes.filter((candidate) => candidate.marketId !== options.market.id);
            nextQuotes.push(demoEntry);
            await this.storage.setQuoteCache({
              quotes: nextQuotes,
              lastSuccessfulRefreshAt: fetchedAt,
            });
          });

          return {
            marketId: options.market.id,
            status: 'updated',
            quote: demoQuote,
            entry: demoEntry,
            stale: false,
            error: null,
          };
        }

        if (options.currentEntry) {
          const retryAfterAt = new Date(options.now.getTime() + getFailureBackoffForState(options.marketState.state)).toISOString();
          const failedEntry: CachedQuoteEntry = {
            ...options.currentEntry,
            retryAfterAt,
          };
          await this.enqueueWrite(async () => {
            const current = this.getSnapshot();
            const nextQuotes = current.quotes.filter((candidate) => candidate.marketId !== options.market.id);
            nextQuotes.push(failedEntry);
            await this.storage.setQuoteCache({
              quotes: nextQuotes,
              lastSuccessfulRefreshAt: current.lastSuccessfulRefreshAt,
            });
          });
          return {
            marketId: options.market.id,
            status: 'failed',
            quote: options.currentEntry.quote,
            entry: failedEntry,
            stale: true,
            error: marketDataError,
          };
        }
        const retryAfterAt = new Date(options.now.getTime() + getFailureBackoffForState(options.marketState.state)).toISOString();
        const unavailableEntry: CachedQuoteEntry = {
          marketId: options.market.id,
          quote: createUnavailableQuote(options.market, options.provider.id),
          fetchedAt: options.now.toISOString(),
          providerTimestamp: null,
          expiresAt: retryAfterAt,
          retryAfterAt,
          providerId: options.provider.id,
        };
        await this.enqueueWrite(async () => {
          const current = this.getSnapshot();
          const nextQuotes = current.quotes.filter((candidate) => candidate.marketId !== options.market.id);
          nextQuotes.push(unavailableEntry);
          await this.storage.setQuoteCache({
            quotes: nextQuotes,
            lastSuccessfulRefreshAt: current.lastSuccessfulRefreshAt,
          });
        });
        return {
          marketId: options.market.id,
          status: 'failed',
          quote: createUnavailableQuote(options.market, options.provider.id),
          entry: unavailableEntry,
          stale: true,
          error: marketDataError,
        };
      }

      const fallbackError = new MarketDataError(
        'unknown_error',
        error instanceof Error ? error.message : 'Unknown market data failure.',
      );
      if (options.currentEntry) {
        return {
          marketId: options.market.id,
          status: 'failed',
          quote: options.currentEntry.quote,
          entry: options.currentEntry,
          stale: true,
          error: fallbackError,
        };
      }
      return {
        marketId: options.market.id,
        status: 'failed',
        quote: createUnavailableQuote(options.market, options.provider.id),
        entry: null,
        stale: true,
        error: fallbackError,
      };
    }
  }
}

export function createMarketQuoteCacheService(
  storage: ExtensionStorageController,
  providers: Record<string, MarketDataProvider>,
): MarketQuoteCacheService {
  return new MarketQuoteCacheService(storage, providers);
}

export function createEmptyQuoteCache(): QuoteCacheState {
  return createDefaultQuoteCache();
}
