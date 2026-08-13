import type { MarketDefinition } from '../domain/market';
import { validateMarketDefinitions } from '../domain/validation';

const allWeekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;

export const MARKET_DEFINITIONS = [
  {
    id: 'nse',
    exchangeCode: 'NSE',
    country: 'India',
    indexName: 'SENSEX',
    timezone: 'Asia/Kolkata',
    colorToken: 'market-india',
    iconId: 'flag-in',
    sessions: [
      {
        id: 'regular',
        label: 'Regular session',
        weekdays: [...allWeekdays],
        openTime: '09:15',
        closeTime: '15:30',
        kind: 'regular',
      },
    ],
    providerSymbols: [
      {
        providerId: 'twelvedata',
        symbol: 'BSESN',
        isDefault: true,
        fallbackSymbols: ['SENSEX1', 'SENSEXETF', 'INDA'],
        notes: 'Prefer the direct S&P BSE Sensex index, then local INR fallback symbols on Twelve Data.',
      },
      {
        providerId: 'mock',
        symbol: 'SENSEX',
      },
    ],
  },
  {
    id: 'tse',
    exchangeCode: 'TSE',
    country: 'Japan',
    indexName: 'Nikkei 225',
    timezone: 'Asia/Tokyo',
    colorToken: 'market-japan',
    iconId: 'flag-jp',
    sessions: [
      {
        id: 'morning',
        label: 'Morning session',
        weekdays: [...allWeekdays],
        openTime: '09:00',
        closeTime: '11:30',
        kind: 'morning',
      },
      {
        id: 'afternoon',
        label: 'Afternoon session',
        weekdays: [...allWeekdays],
        openTime: '12:30',
        closeTime: '15:30',
        kind: 'afternoon',
      },
    ],
    providerSymbols: [
      {
        providerId: 'twelvedata',
        symbol: 'N225',
        isDefault: true,
        fallbackSymbols: ['1320', '1330'],
        notes: 'Prefer the direct Nikkei 225 index, then local JPY fallback symbols on Twelve Data.',
      },
      {
        providerId: 'mock',
        symbol: 'Nikkei 225',
      },
    ],
  },
  {
    id: 'lse',
    exchangeCode: 'LSE',
    country: 'United Kingdom',
    indexName: 'FTSE 100',
    timezone: 'Europe/London',
    colorToken: 'market-uk',
    iconId: 'flag-gb',
    sessions: [
      {
        id: 'regular',
        label: 'Regular session',
        weekdays: [...allWeekdays],
        openTime: '08:00',
        closeTime: '16:30',
        kind: 'regular',
      },
    ],
    providerSymbols: [
      {
        providerId: 'twelvedata',
        symbol: 'FTSE',
        isDefault: true,
        fallbackSymbols: ['HUKX', 'S100'],
        notes: 'Prefer the direct FTSE 100 index, then local GBP fallback symbols on Twelve Data.',
      },
      {
        providerId: 'mock',
        symbol: 'FTSE 100',
      },
    ],
  },
  {
    id: 'nyse',
    exchangeCode: 'NYSE',
    country: 'United States',
    indexName: 'S&P 500',
    timezone: 'America/New_York',
    colorToken: 'market-us',
    iconId: 'flag-us',
    sessions: [
      {
        id: 'regular',
        label: 'Regular session',
        weekdays: [...allWeekdays],
        openTime: '09:30',
        closeTime: '16:00',
        kind: 'regular',
      },
    ],
    providerSymbols: [
      {
        providerId: 'twelvedata',
        symbol: 'SPX',
        isDefault: true,
        fallbackSymbols: ['SPY'],
        notes: 'Prefer the direct S&P 500 index, then local USD fallback symbols on Twelve Data.',
      },
      {
        providerId: 'mock',
        symbol: 'S&P 500',
      },
    ],
  },
  {
    id: 'hkex',
    exchangeCode: 'HKEX',
    country: 'Hong Kong',
    indexName: 'Hang Seng',
    timezone: 'Asia/Hong_Kong',
    colorToken: 'market-hk',
    iconId: 'flag-hk',
    sessions: [
      {
        id: 'morning',
        label: 'Morning session',
        weekdays: [...allWeekdays],
        openTime: '09:30',
        closeTime: '12:00',
        kind: 'morning',
      },
      {
        id: 'afternoon',
        label: 'Afternoon session',
        weekdays: [...allWeekdays],
        openTime: '13:00',
        closeTime: '16:00',
        kind: 'afternoon',
      },
    ],
    providerSymbols: [
      {
        providerId: 'twelvedata',
        symbol: 'HSI',
        isDefault: true,
        fallbackSymbols: ['2800'],
        notes: 'Prefer the direct Hang Seng index, then local HKD fallback symbols on Twelve Data.',
      },
      {
        providerId: 'mock',
        symbol: 'Hang Seng',
      },
    ],
  },
  {
    id: 'xetra',
    exchangeCode: 'Xetra',
    country: 'Germany',
    indexName: 'DAX',
    timezone: 'Europe/Berlin',
    colorToken: 'market-germany',
    iconId: 'flag-de',
    sessions: [
      {
        id: 'regular',
        label: 'Regular session',
        weekdays: [...allWeekdays],
        openTime: '09:00',
        closeTime: '17:30',
        kind: 'regular',
      },
    ],
    providerSymbols: [
      {
        providerId: 'twelvedata',
        symbol: 'GDAXI',
        isDefault: true,
        fallbackSymbols: ['EXS1', 'DAXEX'],
        notes: 'Prefer the direct DAX index, then local EUR fallback symbols on Twelve Data.',
      },
      {
        providerId: 'mock',
        symbol: 'DAX',
      },
    ],
  },
] satisfies MarketDefinition[];

export const MARKET_DEFINITIONS_VALIDATION = validateMarketDefinitions(MARKET_DEFINITIONS);

export const MARKET_IDS = MARKET_DEFINITIONS.map((market) => market.id) as readonly string[];

export function getMarketDefinition(marketId: string): MarketDefinition | undefined {
  return MARKET_DEFINITIONS.find((market) => market.id === marketId);
}
