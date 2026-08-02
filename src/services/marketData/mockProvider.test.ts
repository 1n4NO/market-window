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
  });

  it('treats any API key as acceptable in demo mode', async () => {
    const provider = new MockMarketDataProvider();
    const result = await provider.validateApiKey('secret');

    expect(result.valid).toBe(true);
    expect(result.code).toBe('valid');
  });
});
