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
          symbol: 'BSESN',
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

    expect(quote.symbol).toBe('BSESN');
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
    vi.mocked(fetch).mockImplementation(async () => {
      return new Response(JSON.stringify({ code: 404, status: 'error', message: 'Symbol not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await expect(provider.fetchQuote(MARKET_DEFINITIONS[0], 'secret')).rejects.toMatchObject({
      code: 'symbol_unavailable',
    });
  });

  it('falls back to the next local candidate when the direct index is unavailable on the plan', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(String(input));
      if (url.searchParams.get('symbol') === 'BSESN') {
        return new Response(
          JSON.stringify({
            code: 403,
            status: 'error',
            message: 'Symbol is not available with your plan.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.searchParams.get('symbol') === 'SENSEX1') {
        return new Response(
          JSON.stringify({
            symbol: 'SENSEX1',
            close: '24501.10',
            previous_close: '24491.10',
            currency: 'INR',
            timestamp: 1764579600,
            is_market_open: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      throw new Error(`Unexpected symbol ${url.searchParams.get('symbol')}`);
    });

    const quote = await provider.fetchQuote(MARKET_DEFINITIONS[0], 'secret');

    expect(quote.symbol).toBe('SENSEX1');
    expect(quote.currency).toBe('INR');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });
});
