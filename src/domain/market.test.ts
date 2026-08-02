import { describe, expect, it } from 'vitest';
import { MARKET_DEFINITIONS } from '../config/markets';
import {
  validateMarketDefinition,
  validateMarketDefinitions,
  validateQuickLink,
  validateUserSettings,
} from './validation';

describe('market definitions', () => {
  it('accepts the bundled market definitions', () => {
    const result = validateMarketDefinitions(MARKET_DEFINITIONS);

    expect(result.valid).toBe(true);
    if (!result.valid) {
      throw new Error('Expected bundled market definitions to validate.');
    }
    expect(result.value).toHaveLength(6);
  });

  it('keeps split-session markets as multiple sessions', () => {
    const tse = MARKET_DEFINITIONS.find((market) => market.id === 'tse');
    const hkex = MARKET_DEFINITIONS.find((market) => market.id === 'hkex');

    expect(tse?.sessions).toHaveLength(2);
    expect(hkex?.sessions).toHaveLength(2);
  });

  it('rejects an invalid market definition', () => {
    const result = validateMarketDefinition({
      id: 'bad-market',
      exchangeCode: '',
      country: 'Nowhere',
      indexName: 'Invalid',
      timezone: 'Not/A-Timezone',
      colorToken: 'market-bad',
      iconId: 'flag-bad',
      sessions: [
        {
          id: 'regular',
          label: 'Regular session',
          weekdays: ['funday'],
          openTime: '09:00',
          closeTime: '16:00',
        },
      ],
      providerSymbols: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.path.includes('providerSymbols'))).toBe(true);
    expect(result.errors.some((issue) => issue.path.includes('weekdays'))).toBe(true);
    expect(result.errors.some((issue) => issue.path.includes('timezone'))).toBe(true);
  });

  it('rejects duplicate market ids', () => {
    const result = validateMarketDefinitions([
      MARKET_DEFINITIONS[0],
      { ...MARKET_DEFINITIONS[1], id: MARKET_DEFINITIONS[0].id },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes('unique'))).toBe(true);
  });
});

describe('supporting validators', () => {
  it('accepts a valid quick link', () => {
    const result = validateQuickLink({
      id: 'tradingview',
      label: 'TradingView',
      url: 'https://www.tradingview.com',
      enabled: true,
      order: 0,
    });

    expect(result.valid).toBe(true);
  });

  it('accepts a valid settings object', () => {
    const result = validateUserSettings({
      enabledMarketIds: ['nse'],
      marketOrder: ['nse'],
      quickLinks: [
        {
          id: 'tradingview',
          label: 'TradingView',
          url: 'https://www.tradingview.com',
          enabled: true,
          order: 0,
        },
      ],
      appearance: {
        density: 'compact',
        clockFormat: '24h',
        showSearch: true,
        showQuickLinks: true,
      },
      providerSymbolOverrides: {},
      dataProvider: {
        providerId: 'twelvedata',
        apiKey: null,
      },
    });

    expect(result.valid).toBe(true);
  });
});
