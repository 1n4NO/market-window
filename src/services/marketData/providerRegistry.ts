import { MOCK_MARKET_DATA_PROVIDER } from './mockProvider';
import { TWELVE_DATA_MARKET_DATA_PROVIDER } from './twelveDataProvider';
import type { MarketDataProvider } from './marketData';

export const MARKET_DATA_PROVIDERS: Record<string, MarketDataProvider> = {
  mock: MOCK_MARKET_DATA_PROVIDER,
  twelvedata: TWELVE_DATA_MARKET_DATA_PROVIDER,
};

export function getMarketDataProvider(providerId: string): MarketDataProvider | null {
  return MARKET_DATA_PROVIDERS[providerId] ?? null;
}

export function resolveActiveMarketDataProviderId(providerId: string, apiKey: string | null): string {
  if (!apiKey || apiKey.trim().length === 0) {
    return 'mock';
  }
  return providerId in MARKET_DATA_PROVIDERS ? providerId : 'mock';
}
