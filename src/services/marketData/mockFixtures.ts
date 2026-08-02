export interface MockQuoteFixture {
  value: number;
  previousClose: number;
  currency: string;
  asOf: string;
}

export const MOCK_QUOTE_FIXTURES: Record<string, MockQuoteFixture> = {
  nse: {
    value: 24682.35,
    previousClose: 24590.12,
    currency: 'INR',
    asOf: '2026-08-01T10:00:00+05:30',
  },
  tse: {
    value: 41250.19,
    previousClose: 41098.33,
    currency: 'JPY',
    asOf: '2026-08-01T11:00:00+09:00',
  },
  lse: {
    value: 8421.7,
    previousClose: 8398.55,
    currency: 'GBP',
    asOf: '2026-08-01T15:30:00+01:00',
  },
  nyse: {
    value: 5508.91,
    previousClose: 5489.22,
    currency: 'USD',
    asOf: '2026-08-01T16:00:00-04:00',
  },
  hkex: {
    value: 17652.88,
    previousClose: 17595.14,
    currency: 'HKD',
    asOf: '2026-08-01T16:00:00+08:00',
  },
  xetra: {
    value: 18512.44,
    previousClose: 18470.11,
    currency: 'EUR',
    asOf: '2026-08-01T17:30:00+02:00',
  },
};
