import { describe, expect, it } from 'vitest';
import { MARKET_DEFINITIONS } from '../../config/markets';
import type { MarketClockState, MarketDefinition } from '../../domain/market';
import { buildMarketHoursTimelineModel } from './marketTimeline';

function market(id: string): MarketDefinition {
  const definition = MARKET_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) {
    throw new Error(`Missing market definition: ${id}`);
  }
  return definition;
}

function createClockState(
  state: MarketClockState['state'],
  marketDefinition: MarketDefinition,
  nextAction: string,
): MarketClockState {
  return {
    state,
    nextTransitionAt: '2026-08-03T12:00:00.000Z',
    previousTransitionAt: '2026-08-03T08:00:00.000Z',
    millisecondsUntilTransition: 3600000,
    activeSession: marketDefinition.sessions[0] ?? null,
    nextSession: marketDefinition.sessions[0] ?? null,
    nextAction,
    holidayConfidence: 'confirmed',
  };
}

function overnightMarket(): MarketDefinition {
  return {
    id: 'overnight',
    exchangeCode: 'OVN',
    country: 'Testland',
    indexName: 'Overnight Index',
    timezone: 'UTC',
    colorToken: 'market-india',
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

describe('buildMarketHoursTimelineModel', () => {
  it('projects a normal session into local-time minutes', () => {
    const lse = market('lse');
    const model = buildMarketHoursTimelineModel({
      markets: [lse],
      marketStates: {
        lse: createClockState('open', lse, 'Closes in 6h 30m'),
      },
      instant: new Date('2026-08-03T09:00:00.000Z'),
      viewerTimeZone: 'Europe/London',
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].segments).toHaveLength(1);
    expect(model.rows[0].segments[0].startMinute).toBe(480);
    expect(model.rows[0].segments[0].endMinute).toBe(990);
    expect(model.currentMarkerLeftPercent).toBeCloseTo((10 / 24) * 100);
  });

  it('projects split sessions with a lunch gap', () => {
    const tse = market('tse');
    const model = buildMarketHoursTimelineModel({
      markets: [tse],
      marketStates: {
        tse: createClockState('lunch-break', tse, 'Reopens in 30m'),
      },
      instant: new Date('2026-08-03T03:00:00.000Z'),
      viewerTimeZone: 'Asia/Tokyo',
    });

    expect(model.rows[0].segments).toHaveLength(2);
    expect(model.rows[0].segments[0].startMinute).toBe(540);
    expect(model.rows[0].segments[0].endMinute).toBe(690);
    expect(model.rows[0].segments[1].startMinute).toBe(750);
    expect(model.rows[0].segments[1].endMinute).toBe(930);
  });

  it('projects a session that wraps past midnight', () => {
    const marketDefinition = overnightMarket();
    const model = buildMarketHoursTimelineModel({
      markets: [marketDefinition],
      marketStates: {
        overnight: createClockState('open', marketDefinition, 'Closes in 2h'),
      },
      instant: new Date('2026-08-05T23:30:00.000Z'),
      viewerTimeZone: 'UTC',
    });

    expect(model.rows[0].segments).toHaveLength(2);
    expect(model.rows[0].segments[0].startMinute).toBe(0);
    expect(model.rows[0].segments[0].endMinute).toBe(120);
    expect(model.rows[0].segments[0].continuesBeforeDay).toBe(true);
    expect(model.rows[0].segments[1].startMinute).toBe(1320);
    expect(model.rows[0].segments[1].endMinute).toBe(1440);
    expect(model.rows[0].segments[1].continuesAfterDay).toBe(true);
  });

  it('converts timezone projections into the viewer timezone', () => {
    const tse = market('tse');
    const model = buildMarketHoursTimelineModel({
      markets: [tse],
      marketStates: {
        tse: createClockState('closed', tse, 'Opens tomorrow at 09:00'),
      },
      instant: new Date('2026-08-03T14:00:00.000Z'),
      viewerTimeZone: 'America/New_York',
    });

    expect(model.rows[0].segments).toHaveLength(3);
    expect(model.rows[0].segments[0].localStartLabel).toBe('00:00');
    expect(model.rows[0].segments[0].localEndLabel).toBe('02:30');
    expect(model.rows[0].segments[0].continuesBeforeDay).toBe(true);
  });

  it('preserves market order and omits disabled markets', () => {
    const nyse = market('nyse');
    const nse = market('nse');

    const reordered = buildMarketHoursTimelineModel({
      markets: [nyse, nse],
      marketStates: {
        nyse: createClockState('open', nyse, 'Closes in 6h'),
        nse: createClockState('closed', nse, 'Opens in 45m'),
      },
      instant: new Date('2026-08-03T09:00:00.000Z'),
      viewerTimeZone: 'UTC',
    });

    expect(reordered.rows.map((row) => row.market.id)).toEqual(['nyse', 'nse']);

    const disabled = buildMarketHoursTimelineModel({
      markets: [nse],
      marketStates: {
        nse: createClockState('closed', nse, 'Opens in 45m'),
      },
      instant: new Date('2026-08-03T09:00:00.000Z'),
      viewerTimeZone: 'UTC',
    });

    expect(disabled.rows).toHaveLength(1);
    expect(disabled.rows[0].market.id).toBe('nse');
  });
});
