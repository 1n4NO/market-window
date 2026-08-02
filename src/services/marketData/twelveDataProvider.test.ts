import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MARKET_DEFINITIONS } from '../../config/markets';
import { TwelveDataMarketDataProvider } from './twelveDataProvider';

describe('TwelveDataMarketDataProvider', () => {
  const provider = new TwelveDataMarketDataProvider();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes quote payloads and computes change fields', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          symbol: 'NSE:NIFTY',
          close: '24650.50',
          previous_close: '24500.50',
          currency: 'INR',
          timestamp: 1764579600,
          is_market_open: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const quote = await provider.fetchQuote(MARKET_DEFINITIONS[0], 'secret');

    expect(quote.symbol).toBe('NSE:NIFTY');
    expect(quote.provider).toBe('twelvedata');
    expect(quote.value).toBeCloseTo(24650.5);
    expect(quote.previousClose).toBeCloseTo(24500.5);
    expect(quote.absoluteChange).toBeCloseTo(150);
    expect(quote.percentageChange).toBeCloseTo((150 / 24500.5) * 100);
    expect(quote.dataState).toBe('delayed');
    expect(quote.asOf).toBe(new Date(1764579600 * 1000).toISOString());
  });

  it('rejects rate-limited responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 429, status: 'error', message: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(provider.fetchQuote(MARKET_DEFINITIONS[0], 'secret')).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('rejects unavailable symbols', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 404, status: 'error', message: 'Symbol not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(provider.fetchQuote(MARKET_DEFINITIONS[0], 'secret')).rejects.toMatchObject({
      code: 'symbol_unavailable',
    });
  });
});
