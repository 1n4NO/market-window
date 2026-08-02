import { formatInTimeZone } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { MARKET_DEFINITIONS } from '../../config/markets';
import type { MarketDefinition } from '../../domain/market';
import { getMarketClockState, type HolidayProvider } from './marketClock';

function market(id: string): MarketDefinition {
  const definition = MARKET_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) {
    throw new Error(`Missing market definition: ${id}`);
  }
  return definition;
}

function overnightMarket(): MarketDefinition {
  return {
    id: 'overnight',
    exchangeCode: 'OVN',
    country: 'Testland',
    indexName: 'Overnight Index',
    timezone: 'UTC',
    colorToken: 'market-test',
    iconId: 'flag-test',
    sessions: [
      {
        id: 'night',
        label: 'Night session',
        weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        openTime: '22:00',
        closeTime: '02:00',
      },
    ],
    providerSymbols: [
      {
        providerId: 'mock',
        symbol: 'OVN',
        isDefault: true,
      },
    ],
  };
}

describe('getMarketClockState', () => {
  it('calculates NSE pre-market correctly', async () => {
    const result = await getMarketClockState(market('nse'), new Date('2026-08-03T03:00:00.000Z'));

    expect(result.state).toBe('pre-market');
    expect(result.nextTransitionAt).toBe('2026-08-03T03:45:00.000Z');
    expect(result.previousTransitionAt).toBe('2026-07-31T10:00:00.000Z');
    expect(result.activeSession).toBeNull();
    expect(result.nextSession?.label).toBe('Regular session');
    expect(result.nextAction).toBe('Opens in 45m');
  });

  it('calculates Tokyo lunch break correctly', async () => {
    const result = await getMarketClockState(market('tse'), new Date('2026-08-03T03:00:00.000Z'));

    expect(result.state).toBe('lunch-break');
    expect(result.nextTransitionAt).toBe('2026-08-03T03:30:00.000Z');
    expect(result.previousTransitionAt).toBe('2026-08-03T02:30:00.000Z');
    expect(result.activeSession).toBeNull();
    expect(result.nextSession?.label).toBe('Afternoon session');
    expect(result.nextAction).toBe('Reopens in 30m');
  });

  it('calculates London open state correctly', async () => {
    const result = await getMarketClockState(market('lse'), new Date('2026-08-03T09:00:00.000Z'));

    expect(result.state).toBe('open');
    expect(result.nextTransitionAt).toBe('2026-08-03T15:30:00.000Z');
    expect(result.previousTransitionAt).toBe('2026-08-03T07:00:00.000Z');
    expect(result.activeSession?.label).toBe('Regular session');
    expect(result.nextAction).toBe('Closes in 6h 30m');
  });

  it('calculates New York open state correctly', async () => {
    const result = await getMarketClockState(market('nyse'), new Date('2026-08-03T14:00:00.000Z'));

    expect(result.state).toBe('open');
    expect(result.nextTransitionAt).toBe('2026-08-03T20:00:00.000Z');
    expect(result.previousTransitionAt).toBe('2026-08-03T13:30:00.000Z');
    expect(result.activeSession?.label).toBe('Regular session');
    expect(result.nextAction).toBe('Closes in 6h');
  });

  it('calculates Hong Kong lunch break correctly', async () => {
    const result = await getMarketClockState(market('hkex'), new Date('2026-08-03T04:30:00.000Z'));

    expect(result.state).toBe('lunch-break');
    expect(result.nextTransitionAt).toBe('2026-08-03T05:00:00.000Z');
    expect(result.previousTransitionAt).toBe('2026-08-03T04:00:00.000Z');
    expect(result.nextSession?.label).toBe('Afternoon session');
    expect(result.nextAction).toBe('Reopens in 30m');
  });

  it('calculates Xetra open state correctly', async () => {
    const result = await getMarketClockState(market('xetra'), new Date('2026-08-03T08:00:00.000Z'));

    expect(result.state).toBe('open');
    expect(result.nextTransitionAt).toBe('2026-08-03T15:30:00.000Z');
    expect(result.previousTransitionAt).toBe('2026-08-03T07:00:00.000Z');
    expect(result.activeSession?.label).toBe('Regular session');
    expect(result.nextAction).toBe('Closes in 7h 30m');
  });

  it('marks a weekday holiday when the provider says the market is closed', async () => {
    const holidayProvider: HolidayProvider = {
      async isHoliday(marketId, date) {
        return marketId === 'nse' && formatInTimeZone(date, 'Asia/Kolkata', 'yyyy-MM-dd') === '2026-08-03';
      },
    };

    const result = await getMarketClockState(market('nse'), new Date('2026-08-03T03:00:00.000Z'), holidayProvider);

    expect(result.state).toBe('holiday');
    expect(result.nextTransitionAt).toBe('2026-08-04T03:45:00.000Z');
    expect(result.previousTransitionAt).toBe('2026-07-31T10:00:00.000Z');
    expect(result.nextAction).toBe('Opens tomorrow at 09:15');
  });

  it('returns weekend state and skips to the next trading session', async () => {
    const result = await getMarketClockState(market('nyse'), new Date('2026-08-08T16:00:00.000Z'));

    expect(result.state).toBe('weekend');
    expect(result.nextTransitionAt).toBe('2026-08-10T13:30:00.000Z');
    expect(result.previousTransitionAt).toBe('2026-08-07T20:00:00.000Z');
    expect(result.nextSession?.label).toBe('Regular session');
    expect(result.nextAction).toBe('Opens on Monday at 09:30');
  });

  it('supports month and year boundaries for overnight sessions', async () => {
    const overnight = overnightMarket();

    const monthBoundary = await getMarketClockState(overnight, new Date('2026-01-31T23:30:00.000Z'));
    expect(monthBoundary.state).toBe('open');
    expect(monthBoundary.previousTransitionAt).toBe('2026-01-31T22:00:00.000Z');
    expect(monthBoundary.nextTransitionAt).toBe('2026-02-01T02:00:00.000Z');

    const yearBoundary = await getMarketClockState(overnight, new Date('2026-12-31T23:30:00.000Z'));
    expect(yearBoundary.state).toBe('open');
    expect(yearBoundary.previousTransitionAt).toBe('2026-12-31T22:00:00.000Z');
    expect(yearBoundary.nextTransitionAt).toBe('2027-01-01T02:00:00.000Z');
  });

  it('supports midnight crossings for overnight sessions', async () => {
    const overnight = overnightMarket();

    const result = await getMarketClockState(overnight, new Date('2026-08-05T00:30:00.000Z'));

    expect(result.state).toBe('open');
    expect(result.activeSession?.label).toBe('Night session');
    expect(result.previousTransitionAt).toBe('2026-08-04T22:00:00.000Z');
    expect(result.nextTransitionAt).toBe('2026-08-05T02:00:00.000Z');
  });

  it('returns unknown for a malformed market definition', async () => {
    const result = await getMarketClockState(
      {
        id: 'broken',
        exchangeCode: 'BRK',
        country: 'Nowhere',
        indexName: 'Broken',
        timezone: 'UTC',
        colorToken: 'market-broken',
        iconId: 'flag-broken',
        sessions: [],
        providerSymbols: [],
      } as unknown as MarketDefinition,
      new Date('2026-08-03T12:00:00.000Z'),
    );

    expect(result.state).toBe('unknown');
    expect(result.nextTransitionAt).toBeNull();
    expect(result.nextAction).toBeNull();
  });

  it('handles DST changes for New York, London and Berlin', async () => {
    const newYork = await getMarketClockState(market('nyse'), new Date('2026-03-09T13:30:00.000Z'));
    const london = await getMarketClockState(market('lse'), new Date('2026-03-30T07:30:00.000Z'));
    const berlin = await getMarketClockState(market('xetra'), new Date('2026-03-30T07:30:00.000Z'));

    expect(newYork.state).toBe('open');
    expect(newYork.nextTransitionAt).toBe('2026-03-09T20:00:00.000Z');
    expect(newYork.nextAction).toBe('Closes in 6h 30m');

    expect(london.state).toBe('open');
    expect(london.nextTransitionAt).toBe('2026-03-30T15:30:00.000Z');
    expect(london.nextAction).toBe('Closes in 8h');

    expect(berlin.state).toBe('open');
    expect(berlin.nextTransitionAt).toBe('2026-03-30T15:30:00.000Z');
    expect(berlin.nextAction).toBe('Closes in 8h');
  });
});
