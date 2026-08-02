import type { MarketDefinition, MarketQuote } from '../../domain/market';
import { createMarketQuote, resolveMarketProviderSymbol, type MarketDataProvider, type ProviderValidationResult } from './marketData';
import { MOCK_QUOTE_FIXTURES } from './mockFixtures';

const DEMO_PROVIDER_ID = 'mock';

export class MockMarketDataProvider implements MarketDataProvider {
  id = DEMO_PROVIDER_ID;

  capabilities = {
    quotes: true,
    historicalSeries: true,
    marketMovers: false,
    moverUniverse: 'unsupported',
  } as const;

  async validateApiKey(apiKey: string): Promise<ProviderValidationResult> {
    if (apiKey.trim().length > 0) {
      return {
        valid: true,
        code: 'valid',
        message: 'Demo provider ignores API keys.',
      };
    }
    return {
      valid: true,
      code: 'valid',
      message: 'Demo provider does not require an API key.',
    };
  }

  async fetchQuote(market: MarketDefinition, apiKey: string): Promise<MarketQuote> {
    void apiKey;
    const symbol = resolveMarketProviderSymbol(market, this.id);
    if (!symbol) {
      throw new Error(`No mock symbol configured for market "${market.id}".`);
    }

    const fixture = MOCK_QUOTE_FIXTURES[market.id];
    if (!fixture) {
      return createMarketQuote({
        marketId: market.id,
        symbol,
        indexName: market.indexName,
        value: null,
        previousClose: null,
        absoluteChange: null,
        percentageChange: null,
        currency: null,
        asOf: null,
        dataState: 'unavailable',
        provider: this.id,
      });
    }

    return createMarketQuote({
      marketId: market.id,
      symbol,
      indexName: market.indexName,
      value: fixture.value,
      previousClose: fixture.previousClose,
      absoluteChange: null,
      percentageChange: null,
      dayHigh: fixture.dayHigh,
      dayLow: fixture.dayLow,
      intradaySeries: fixture.intradaySeries,
      currency: fixture.currency,
      asOf: fixture.asOf,
      dataState: 'mock',
      provider: this.id,
    });
  }
}

export const MOCK_MARKET_DATA_PROVIDER = new MockMarketDataProvider();
