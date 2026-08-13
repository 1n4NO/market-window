import { describe, expect, it, vi } from 'vitest';
import { MARKET_DEFINITIONS } from '../../config/markets';
import type { MarketClockState, MarketDefinition, MarketMoversSnapshot } from '../../domain/market';
import { MarketDataError, type MarketDataProvider, createMarketQuote } from '../marketData/marketData';
import { createMemoryStorageAdapter } from '../storage/extensionStorage';
import {
  MarketMoversCacheService,
  buildMarketMoversPanelModel,
  isMarketMoversEntryStale,
  isMoversModuleSupported,
} from './marketMovers';

function getMarket(id: string): MarketDefinition {
  const market = MARKET_DEFINITIONS.find((entry) => entry.id === id);
  if (!market) {
    throw new Error(`Missing market definition: ${id}`);
  }
  return market;
}

function createClockState(state: MarketClockState['state'], nextTransitionAt: string): MarketClockState {
  return {
    state,
    nextTransitionAt,
    previousTransitionAt: '2026-08-02T03:30:00.000Z',
    millisecondsUntilTransition: 3_600_000,
    activeSession: getMarket('nse').sessions[0] ?? null,
    nextSession: null,
    nextAction: 'Closes in 1h',
    holidayConfidence: 'confirmed',
  };
}

function createSupportedMarket(): MarketDefinition {
  return {
    ...getMarket('nse'),
    moverCoverage: {
      supportedUniverses: ['exchange'],
    },
  };
}

function createProvider(fetchMovers: ReturnType<typeof vi.fn>): MarketDataProvider {
  return {
    id: 'movers-demo',
    capabilities: {
      quotes: true,
      historicalSeries: true,
      marketMovers: true,
      moverUniverse: 'exchange',
    },
    validateApiKey: async () => ({ valid: true, code: 'valid', message: null }),
    fetchQuote: async () =>
      createMarketQuote({
        marketId: 'nse',
        symbol: 'NSE:BSESN',
        indexName: 'SENSEX',
        value: 25000,
        previousClose: 24900,
        absoluteChange: 100,
        percentageChange: 0.4,
        currency: 'INR',
        asOf: '2026-08-02T09:00:00.000Z',
        dataState: 'mock',
        provider: 'movers-demo',
      }),
    fetchMovers,
  };
}

function createMoverSnapshot(): MarketMoversSnapshot {
  return {
    marketId: 'nse',
    indexName: 'SENSEX',
    provider: 'movers-demo',
    universe: 'exchange',
    dataState: 'delayed',
    asOf: '2026-08-02T09:00:00.000Z',
    movers: [
      {
        kind: 'largest_percentage_gainer',
        symbol: 'AAA',
        name: 'Alpha',
        value: 101,
        previousClose: 95,
        absoluteChange: 6,
        percentageChange: 6.32,
        asOf: '2026-08-02T09:00:00.000Z',
        dataState: 'delayed',
      },
      {
        kind: 'largest_percentage_loser',
        symbol: 'BBB',
        name: 'Beta',
        value: 90,
        previousClose: 100,
        absoluteChange: -10,
        percentageChange: -10,
        asOf: '2026-08-02T09:00:00.000Z',
        dataState: 'delayed',
      },
      {
        kind: 'largest_absolute_percentage_move',
        symbol: 'CCC',
        name: 'Gamma',
        value: 120,
        previousClose: 100,
        absoluteChange: 20,
        percentageChange: 20,
        asOf: '2026-08-02T09:00:00.000Z',
        dataState: 'delayed',
      },
    ],
  };
}

describe('market movers module', () => {
  it('renders supported mover data with a disclosed universe', async () => {
    const fetchMovers = vi.fn(async () => createMoverSnapshot());
    const provider = createProvider(fetchMovers);
    const adapter = createMemoryStorageAdapter();
    const service = new MarketMoversCacheService(adapter, { 'movers-demo': provider });
    await service.ready();

    expect(isMoversModuleSupported(provider, createSupportedMarket())).toBe(true);

    const result = await service.refreshMovers({
      market: createSupportedMarket(),
      marketState: createClockState('open', '2026-08-02T10:00:00.000Z'),
      providerId: 'movers-demo',
      apiKey: 'secret',
      now: new Date('2026-08-02T09:00:00.000Z'),
    });

    expect(result.status).toBe('updated');
    expect(result.snapshot?.movers).toHaveLength(3);
    expect(service.getSnapshot().entries).toHaveLength(1);

    const model = buildMarketMoversPanelModel({
      market: createSupportedMarket(),
      marketState: createClockState('open', '2026-08-02T10:00:00.000Z'),
      provider,
      entry: service.getEntry('nse'),
      now: new Date('2026-08-02T09:01:00.000Z'),
    });

    expect(model?.status).toBe('ready');
    expect(model?.universeLabel).toBe('Exchange-wide movers');
    expect(model?.cards[0].label).toBe('Largest percentage gainer');
    expect(model?.cards).toHaveLength(3);
  });

  it('hides unsupported mover coverage', async () => {
    const fetchMovers = vi.fn(async () => createMoverSnapshot());
    const provider = createProvider(fetchMovers);
    const adapter = createMemoryStorageAdapter();
    const service = new MarketMoversCacheService(adapter, { 'movers-demo': provider });
    await service.ready();

    const unsupportedMarket = getMarket('lse');
    const result = await service.refreshMovers({
      market: unsupportedMarket,
      marketState: createClockState('open', '2026-08-02T10:00:00.000Z'),
      providerId: 'movers-demo',
      apiKey: 'secret',
      now: new Date('2026-08-02T09:00:00.000Z'),
    });

    expect(result.status).toBe('unsupported');
    expect(fetchMovers).not.toHaveBeenCalled();
    expect(buildMarketMoversPanelModel({
      market: unsupportedMarket,
      marketState: createClockState('open', '2026-08-02T10:00:00.000Z'),
      provider,
      entry: null,
      now: new Date('2026-08-02T09:01:00.000Z'),
    })).toBeNull();
  });

  it('marks stale mover data as hidden until refreshed', () => {
    const provider = createProvider(vi.fn(async () => createMoverSnapshot()));
    const entry = {
      marketId: 'nse',
      snapshot: createMoverSnapshot(),
      fetchedAt: '2026-08-01T09:00:00.000Z',
      providerTimestamp: '2026-08-01T09:00:00.000Z',
      expiresAt: '2026-08-01T21:00:00.000Z',
      retryAfterAt: null,
      providerId: 'movers-demo',
      universe: 'exchange' as const,
    };

    expect(
      isMarketMoversEntryStale(entry, createClockState('open', '2026-08-02T10:00:00.000Z'), new Date('2026-08-02T09:00:00.000Z')),
    ).toBe(true);

    const model = buildMarketMoversPanelModel({
      market: createSupportedMarket(),
      marketState: createClockState('open', '2026-08-02T10:00:00.000Z'),
      provider,
      entry,
      now: new Date('2026-08-02T09:00:00.000Z'),
    });

    expect(model?.status).toBe('stale');
    expect(model?.cards).toHaveLength(0);
  });

  it('records rate-limited refreshes separately from quotes', async () => {
    const fetchMovers = vi.fn(async () => {
      throw new MarketDataError('rate_limited', 'Too many mover requests.');
    });
    const provider = createProvider(fetchMovers);
    const adapter = createMemoryStorageAdapter();
    const service = new MarketMoversCacheService(adapter, { 'movers-demo': provider });
    await service.ready();

    const result = await service.refreshMovers({
      market: createSupportedMarket(),
      marketState: createClockState('open', '2026-08-02T10:00:00.000Z'),
      providerId: 'movers-demo',
      apiKey: 'secret',
      now: new Date('2026-08-02T09:00:00.000Z'),
    });

    expect(result.status).toBe('rate_limited');
    expect(result.error?.code).toBe('rate_limited');
    expect(service.getSnapshot().entries[0].retryAfterAt).toBe('2026-08-02T21:00:00.000Z');

    const model = buildMarketMoversPanelModel({
      market: createSupportedMarket(),
      marketState: createClockState('open', '2026-08-02T10:00:00.000Z'),
      provider,
      entry: service.getEntry('nse'),
      now: new Date('2026-08-02T09:01:00.000Z'),
      refreshError: result.error,
    });

    expect(model?.status).toBe('rate_limited');
    expect(model?.rateLimitLabel).toContain('Rate limit reached');
  });
});
