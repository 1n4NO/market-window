import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MARKET_DEFINITIONS } from '../../config/markets';
import type { MarketClockState, MarketDefinition, MarketQuote } from '../../domain/market';
import { createMarketQuote } from '../../services/marketData/marketData';
import type { CachedQuoteEntry } from '../../services/storage/extensionStorage';
import { buildMarketDashboardModel } from '../../services/marketDashboard/marketDashboard';
import { MarketCardsGrid } from './MarketCardsGrid';

const viewerTimeZone = 'Asia/Kolkata';
const now = new Date('2026-08-02T08:00:00.000Z');

function getMarket(id: string): MarketDefinition {
  const market = MARKET_DEFINITIONS.find((entry) => entry.id === id);
  if (!market) {
    throw new Error(`Missing market definition: ${id}`);
  }
  return market;
}

function createClockState(
  market: MarketDefinition,
  state: MarketClockState['state'],
  nextAction: string,
  nextTransitionAt: string,
): MarketClockState {
  return {
    state,
    nextTransitionAt,
    previousTransitionAt: '2026-08-02T02:00:00.000Z',
    millisecondsUntilTransition: new Date(nextTransitionAt).getTime() - now.getTime(),
    activeSession: market.sessions[0] ?? null,
    nextSession: market.sessions[1] ?? market.sessions[0] ?? null,
    nextAction,
    holidayConfidence: 'confirmed',
  };
}

function createQuoteEntry(input: {
  market: MarketDefinition;
  value: number | null;
  previousClose: number | null;
  dataState: MarketQuote['dataState'];
  asOf: string;
}): CachedQuoteEntry {
  const quote = createMarketQuote({
    marketId: input.market.id,
    symbol: `${input.market.exchangeCode}:${input.market.id.toUpperCase()}`,
    indexName: input.market.indexName,
    value: input.value,
    previousClose: input.previousClose,
    absoluteChange: null,
    percentageChange: null,
    currency: 'USD',
    asOf: input.asOf,
    dataState: input.dataState,
    provider: 'twelvedata',
  });

  return {
    marketId: input.market.id,
    quote,
    fetchedAt: '2026-08-02T07:50:00.000Z',
    providerTimestamp: input.asOf,
    expiresAt: '2026-08-02T08:05:00.000Z',
    providerId: 'twelvedata',
  };
}

describe('MarketCardsGrid', () => {
  it('renders every market and data state without a mover area', async () => {
    const markets = {
      nse: getMarket('nse'),
      tse: getMarket('tse'),
      lse: getMarket('lse'),
      nyse: getMarket('nyse'),
      hkex: getMarket('hkex'),
      xetra: getMarket('xetra'),
    };

    const marketStates: Record<string, MarketClockState> = {
      nse: createClockState(markets.nse, 'open', 'Closes in 5h 30m', '2026-08-02T14:45:00.000Z'),
      tse: createClockState(markets.tse, 'lunch-break', 'Reopens at 12:30', '2026-08-02T12:30:00.000Z'),
      lse: createClockState(markets.lse, 'closed', 'Opens tomorrow at 08:00', '2026-08-03T07:00:00.000Z'),
      nyse: createClockState(markets.nyse, 'pre-market', 'Opens at 09:30', '2026-08-02T13:30:00.000Z'),
      hkex: createClockState(markets.hkex, 'weekend', 'Opens Monday at 09:30', '2026-08-03T03:30:00.000Z'),
      xetra: createClockState(markets.xetra, 'holiday', 'Opens after holiday', '2026-08-04T07:00:00.000Z'),
    };

    const quoteEntries: Record<string, CachedQuoteEntry | null> = {
      nse: createQuoteEntry({
        market: markets.nse,
        value: 24682.35,
        previousClose: 24590.12,
        dataState: 'live',
        asOf: '2026-08-02T10:00:00+05:30',
      }),
      tse: createQuoteEntry({
        market: markets.tse,
        value: 41250.19,
        previousClose: 41098.33,
        dataState: 'delayed',
        asOf: '2026-08-02T11:00:00+09:00',
      }),
      lse: createQuoteEntry({
        market: markets.lse,
        value: 8421.7,
        previousClose: 8398.55,
        dataState: 'end-of-day',
        asOf: '2026-08-01T16:30:00+01:00',
      }),
      nyse: createQuoteEntry({
        market: markets.nyse,
        value: 5508.91,
        previousClose: 5489.22,
        dataState: 'cached',
        asOf: '2026-08-01T16:00:00-04:00',
      }),
      hkex: createQuoteEntry({
        market: markets.hkex,
        value: 17652.88,
        previousClose: 17595.14,
        dataState: 'mock',
        asOf: '2026-08-01T16:00:00+08:00',
      }),
      xetra: createQuoteEntry({
        market: markets.xetra,
        value: null,
        previousClose: null,
        dataState: 'unavailable',
        asOf: '2026-08-01T17:30:00+02:00',
      }),
    };

    const dashboard = buildMarketDashboardModel({
      markets: [markets.nse, markets.tse, markets.lse, markets.nyse, markets.hkex, markets.xetra],
      marketStates,
      quoteEntries,
      now,
      viewerTimeZone,
      providerLabel: 'Twelve Data',
    });

    const user = userEvent.setup();

    render(<MarketCardsGrid cards={dashboard.cards} now={now} />);

    expect(screen.getByRole('article', { name: 'NSE market card' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'TSE market card' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'LSE market card' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'NYSE market card' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'HKEX market card' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Xetra market card' })).toBeInTheDocument();

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getAllByText('On break').length).toBeGreaterThan(0);
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('Pre-market')).toBeInTheDocument();
    expect(screen.getByText('Weekend')).toBeInTheDocument();
    expect(screen.getByText('Holiday')).toBeInTheDocument();

    expect(screen.getByText('live')).toBeInTheDocument();
    expect(screen.getByText('delayed')).toBeInTheDocument();
    expect(screen.getByText('end of day')).toBeInTheDocument();
    expect(screen.getByText('cached')).toBeInTheDocument();
    expect(screen.getByText('mock')).toBeInTheDocument();
    expect(screen.getByText('unavailable')).toBeInTheDocument();

    expect(screen.getByText('Demo data')).toBeInTheDocument();
    expect(screen.getAllByText('Data unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cached /i).length).toBeGreaterThan(0);

    await user.tab();
    expect(screen.getByRole('article', { name: 'NSE market card' })).toHaveFocus();
  });
});
