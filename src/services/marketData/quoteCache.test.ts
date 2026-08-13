import { describe, expect, it, vi } from 'vitest';
import { MARKET_DEFINITIONS } from '../../config/markets';
import type { MarketClockState, MarketQuote } from '../../domain/market';
import { MarketDataError, type MarketDataProvider, createMarketQuote } from './marketData';
import { MarketQuoteCacheService, computeQuoteExpiryAt, isQuoteCacheEntryStale } from './quoteCache';
import { ExtensionStorageController, createMemoryStorageAdapter } from '../storage/extensionStorage';

function createOpenState(nextTransitionAt = '2026-08-02T10:00:00.000Z'): MarketClockState {
  return {
    state: 'open',
    nextTransitionAt,
    previousTransitionAt: '2026-08-02T03:30:00.000Z',
    millisecondsUntilTransition: 3600000,
    activeSession: MARKET_DEFINITIONS[0].sessions[0],
    nextSession: null,
    nextAction: 'close',
    holidayConfidence: 'confirmed',
  };
}

describe('quote cache service', () => {
  it('detects stale cache entries from explicit expiry timestamps', () => {
    const fetchedAt = new Date('2026-08-02T09:00:00.000Z');
    const expiry = computeQuoteExpiryAt(createOpenState(), fetchedAt, 'delayed');
    const entry = {
      marketId: 'nse',
      quote: createMarketQuote({
        marketId: 'nse',
        symbol: 'NSE:BSESN',
        indexName: 'SENSEX',
        value: 24600,
        previousClose: 24500,
        absoluteChange: 100,
        percentageChange: 0.4,
        currency: 'INR',
        asOf: '2026-08-02T09:00:00.000Z',
        dataState: 'delayed',
        provider: 'twelvedata',
      }),
      fetchedAt: fetchedAt.toISOString(),
      providerTimestamp: '2026-08-02T09:00:00.000Z',
      expiresAt: expiry.toISOString(),
      retryAfterAt: null,
      providerId: 'twelvedata',
    };

    expect(isQuoteCacheEntryStale(entry, createOpenState(), new Date('2026-08-02T09:10:00.000Z'))).toBe(false);
    expect(isQuoteCacheEntryStale(entry, createOpenState(), new Date('2026-08-02T09:20:00.000Z'))).toBe(true);
  });

  it('deduplicates concurrent refreshes for the same market', async () => {
    let resolveQuote!: (value: MarketQuote) => void;
    const fetchQuote = vi.fn(() => {
      return new Promise<ReturnType<typeof createMarketQuote>>((resolve) => {
        resolveQuote = resolve;
      });
    });
    const provider: MarketDataProvider = {
      id: 'mock',
      capabilities: {
        quotes: true,
        historicalSeries: false,
        marketMovers: false,
        moverUniverse: 'unsupported',
      },
      validateApiKey: async () => ({ valid: true, code: 'valid', message: null }),
      fetchQuote: fetchQuote as MarketDataProvider['fetchQuote'],
    };

    const adapter = createMemoryStorageAdapter();
    const controller = new ExtensionStorageController(adapter);
    await controller.ready();
    const service = new MarketQuoteCacheService(controller, { mock: provider });
    const market = MARKET_DEFINITIONS[0];
    const state = createOpenState();

    const options = {
      markets: [market],
      marketStates: { [market.id]: state },
      providerId: 'mock',
      apiKey: '',
      now: new Date('2026-08-02T09:00:00.000Z'),
    };

    const first = service.refreshQuotes(options);
    const second = service.refreshQuotes(options);

    expect(fetchQuote).toHaveBeenCalledTimes(1);

    resolveQuote(
      createMarketQuote({
        marketId: market.id,
        symbol: 'NSE:BSESN',
        indexName: market.indexName,
        value: 24600,
        previousClose: 24500,
        absoluteChange: 100,
        percentageChange: 0.4,
        currency: 'INR',
        asOf: '2026-08-02T09:00:00.000Z',
        dataState: 'mock',
        provider: 'mock',
      }),
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult[0].status).toBe('updated');
    expect(secondResult[0].status).toBe('updated');
    expect(controller.getSnapshot().quoteCache.quotes).toHaveLength(1);
  });

  it('preserves a valid cache when refresh fails', async () => {
    const cachedQuote = createMarketQuote({
      marketId: 'nse',
      symbol: 'NSE:BSESN',
      indexName: 'SENSEX',
      value: 24600,
      previousClose: 24500,
      absoluteChange: 100,
      percentageChange: 0.4,
      currency: 'INR',
      asOf: '2026-08-02T09:00:00.000Z',
      dataState: 'cached',
      provider: 'mock',
    });
    const adapter = createMemoryStorageAdapter();
    const controller = new ExtensionStorageController(adapter);
    await controller.ready();
    await controller.setQuoteCache({
      quotes: [
        {
          marketId: 'nse',
          quote: cachedQuote,
          fetchedAt: '2026-08-02T09:00:00.000Z',
          providerTimestamp: '2026-08-02T09:00:00.000Z',
          expiresAt: '2026-08-02T09:05:00.000Z',
          retryAfterAt: null,
          providerId: 'mock',
        },
      ],
      lastSuccessfulRefreshAt: '2026-08-02T09:00:00.000Z',
    });

    const fetchQuote = vi.fn(async () => {
      throw new MarketDataError('provider_unavailable', 'boom');
    });
    const provider: MarketDataProvider = {
      id: 'mock',
      capabilities: {
        quotes: true,
        historicalSeries: false,
        marketMovers: false,
        moverUniverse: 'unsupported',
      },
      validateApiKey: async () => ({ valid: true, code: 'valid', message: null }),
      fetchQuote,
    };
    const service = new MarketQuoteCacheService(controller, { mock: provider });

    const results = await service.refreshQuotes({
      markets: [MARKET_DEFINITIONS[0]],
      marketStates: { [MARKET_DEFINITIONS[0].id]: createOpenState() },
      providerId: 'mock',
      apiKey: '',
      now: new Date('2026-08-02T09:10:00.000Z'),
    });

    expect(results[0].status).toBe('failed');
    expect(controller.getSnapshot().quoteCache.quotes[0].quote.value).toBe(24600);
    expect(controller.getSnapshot().quoteCache.lastSuccessfulRefreshAt).toBe('2026-08-02T09:00:00.000Z');
    expect(controller.getSnapshot().quoteCache.quotes[0].retryAfterAt).toBe('2026-08-02T09:25:00.000Z');

    const secondResults = await service.refreshQuotes({
      markets: [MARKET_DEFINITIONS[0]],
      marketStates: { [MARKET_DEFINITIONS[0].id]: createOpenState() },
      providerId: 'mock',
      apiKey: '',
      now: new Date('2026-08-02T09:10:00.000Z'),
    });

    expect(fetchQuote).toHaveBeenCalledTimes(1);
    expect(secondResults[0].status).toBe('cached');
  });

  it('keeps healthy markets refreshing when one market fails', async () => {
    const adapter = createMemoryStorageAdapter();
    const controller = new ExtensionStorageController(adapter);
    await controller.ready();

    const provider: MarketDataProvider = {
      id: 'mock',
      capabilities: {
        quotes: true,
        historicalSeries: false,
        marketMovers: false,
        moverUniverse: 'unsupported',
      },
      validateApiKey: async () => ({ valid: true, code: 'valid', message: null }),
      fetchQuote: vi.fn(async (market: { id: string }) => {
        if (market.id === 'nse') {
          throw new MarketDataError('provider_unavailable', 'boom');
        }
        return createMarketQuote({
          marketId: market.id,
          symbol: 'LSE:FTSE',
          indexName: 'FTSE 100',
          value: 8400,
          previousClose: 8390,
          absoluteChange: null,
          percentageChange: null,
          currency: 'GBP',
          asOf: '2026-08-02T09:10:00.000Z',
          dataState: 'mock',
          provider: 'mock',
        });
      }),
    };
    const service = new MarketQuoteCacheService(controller, { mock: provider });

    const results = await service.refreshQuotes({
      markets: [MARKET_DEFINITIONS[0], MARKET_DEFINITIONS[2]],
      marketStates: {
        [MARKET_DEFINITIONS[0].id]: createOpenState(),
        [MARKET_DEFINITIONS[2].id]: createOpenState(),
      },
      providerId: 'mock',
      apiKey: '',
      now: new Date('2026-08-02T09:10:00.000Z'),
    });

    expect(results.find((result) => result.marketId === 'nse')?.status).toBe('failed');
    expect(results.find((result) => result.marketId === 'lse')?.status).toBe('updated');
    expect(controller.getSnapshot().quoteCache.quotes).toHaveLength(2);
  });
});
