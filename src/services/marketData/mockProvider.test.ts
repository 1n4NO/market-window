import { describe, expect, it } from 'vitest';
import { MARKET_DEFINITIONS } from '../../config/markets';
import { MockMarketDataProvider } from './mockProvider';

describe('MockMarketDataProvider', () => {
  it('returns labeled demo data for configured markets', async () => {
    const provider = new MockMarketDataProvider();
    const quote = await provider.fetchQuote(MARKET_DEFINITIONS[0], '');

    expect(quote.provider).toBe('mock');
    expect(quote.dataState).toBe('mock');
    expect(quote.value).not.toBeNull();
    expect(quote.previousClose).not.toBeNull();
    expect(quote.asOf).not.toBeNull();
    expect(quote.dayHigh).not.toBeNull();
    expect(quote.dayLow).not.toBeNull();
    expect(quote.intradaySeries).toBeDefined();
    expect(quote.intradaySeries?.length).toBeGreaterThan(8);
    expect(quote.intradaySeries?.[0]).toBeGreaterThan(0);
    expect(quote.intradaySeries?.[quote.intradaySeries.length - 1]).toBeCloseTo(quote.value ?? 0, 1);
    expect(quote.dayHigh).toBeGreaterThanOrEqual(quote.value ?? 0);
    expect(quote.dayLow).toBeLessThanOrEqual(quote.value ?? 0);
  });

  it('treats any API key as acceptable in demo mode', async () => {
    const provider = new MockMarketDataProvider();
    const result = await provider.validateApiKey('secret');

    expect(result.valid).toBe(true);
    expect(result.code).toBe('valid');
  });

  it('returns deterministic demo series for the same market', async () => {
    const provider = new MockMarketDataProvider();
    const first = await provider.fetchQuote(MARKET_DEFINITIONS[1], '');
    const second = await provider.fetchQuote(MARKET_DEFINITIONS[1], '');

    expect(first.value).toBe(second.value);
    expect(first.previousClose).toBe(second.previousClose);
    expect(first.dayHigh).toBe(second.dayHigh);
    expect(first.dayLow).toBe(second.dayLow);
    expect(first.intradaySeries).toEqual(second.intradaySeries);
  });
});
