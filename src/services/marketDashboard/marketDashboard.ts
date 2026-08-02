import { formatDistanceStrict } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { CachedQuoteEntry } from '../storage/extensionStorage';
import type { MarketClockState, MarketDefinition, MarketQuote, MarketState } from '../../domain/market';
import { isQuoteCacheEntryStale } from '../marketData/quoteCache';

export interface MarketDashboardCardModel {
  market: MarketDefinition;
  clockState: MarketClockState;
  quote: MarketQuote | null;
  quoteEntry: CachedQuoteEntry | null;
  providerLabel: string;
  stateLabel: string;
  valueLabel: string;
  valueTone: 'positive' | 'negative' | 'neutral' | 'warning';
  absoluteChangeLabel: string;
  percentageChangeLabel: string;
  dataStateLabel: MarketQuote['dataState'] | 'cached';
  providerTimestampLabel: string;
  localDisplayTimestampLabel: string;
  sessionHoursLabel: string;
  nextTransitionLabel: string;
  countdownLabel: string;
  cacheAgeLabel: string | null;
  errorLabel: string | null;
  demoLabel: boolean;
  staleLabel: string | null;
  marketStateTone: 'neutral' | 'positive' | 'warning' | 'negative' | 'accent';
}

export interface MarketTransitionItem {
  marketId: string;
  exchangeCode: string;
  country: string;
  transitionAt: string;
  actionLabel: string;
  state: MarketState;
}

export interface MarketSummaryModel {
  open: number;
  closed: number;
  onBreak: number;
  openingWithinThreeHours: number;
  total: number;
  closedPercentage: number;
}

export interface MarketDashboardModel {
  cards: MarketDashboardCardModel[];
  transitions: MarketTransitionItem[];
  summary: MarketSummaryModel;
}

function formatSignedNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  })}`;
}

function formatSignedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${Math.abs(value).toFixed(2)}%`;
}

function formatMarketState(state: MarketState): string {
  switch (state) {
    case 'pre-market':
      return 'Pre-market';
    case 'lunch-break':
      return 'On break';
    case 'weekend':
      return 'Weekend';
    case 'holiday':
      return 'Holiday';
    case 'unknown':
      return 'Unknown';
    case 'open':
      return 'Open';
    case 'closed':
      return 'Closed';
    default:
      return 'Unknown';
  }
}

function getTimeZoneAbbreviation(timeZone: string): string {
  if (timeZone === 'Asia/Kolkata') {
    return 'IST';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  });
  return formatter.formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value ?? '';
}

function formatSessionHours(market: MarketDefinition): string {
  const timeZoneAbbreviation = getTimeZoneAbbreviation(market.timezone);
  return market.sessions
    .map((session) => `${session.label.replace(/ session$/i, '')} ${session.openTime}–${session.closeTime} ${timeZoneAbbreviation}`)
    .join(' · ');
}

function getLatestQuote(quoteEntry: CachedQuoteEntry | null): MarketQuote | null {
  return quoteEntry?.quote ?? null;
}

function getCacheAgeLabel(quoteEntry: CachedQuoteEntry | null, now: Date): string | null {
  if (!quoteEntry) {
    return null;
  }
  const fetchedAt = new Date(quoteEntry.fetchedAt);
  if (Number.isNaN(fetchedAt.getTime())) {
    return null;
  }
  return `Cached ${formatDistanceStrict(fetchedAt, now, { addSuffix: true })}`;
}

function getStaleLabel(quoteEntry: CachedQuoteEntry | null, clockState: MarketClockState, now: Date): string | null {
  if (!quoteEntry) {
    return null;
  }
  return isQuoteCacheEntryStale(quoteEntry, clockState, now) ? 'Cached data stale' : null;
}

function getDisplayTimestamp(iso: string | null, viewerTimeZone: string): string {
  if (!iso) {
    return 'n/a';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return 'n/a';
  }
  return formatInTimeZone(parsed, viewerTimeZone, 'PP p zzz');
}

function getLocalMarketTimestamp(iso: string | null, market: MarketDefinition): string {
  if (!iso) {
    return 'n/a';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return 'n/a';
  }
  return formatInTimeZone(parsed, market.timezone, 'PP p zzz');
}

function getValueTone(value: number | null): 'positive' | 'negative' | 'neutral' | 'warning' {
  if (value === null || !Number.isFinite(value)) {
    return 'neutral';
  }
  if (value > 0) {
    return 'positive';
  }
  if (value < 0) {
    return 'negative';
  }
  return 'neutral';
}

function formatCountdown(millisecondsUntilTransition: number | null): string {
  if (millisecondsUntilTransition === null) {
    return 'n/a';
  }
  const totalMinutes = Math.max(0, Math.floor(millisecondsUntilTransition / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getNextTransitionLabel(clockState: MarketClockState): string {
  if (!clockState.nextAction) {
    return 'No upcoming transition';
  }
  return clockState.nextAction;
}

function getSummaryFromStates(clockStates: MarketClockState[]): MarketSummaryModel {
  const summary: MarketSummaryModel = {
    open: 0,
    closed: 0,
    onBreak: 0,
    openingWithinThreeHours: 0,
    total: clockStates.length,
    closedPercentage: 0,
  };

  for (const state of clockStates) {
    if (state.state === 'open') {
      summary.open += 1;
    } else if (state.state === 'lunch-break') {
      summary.onBreak += 1;
    } else if (state.state !== 'unknown') {
      summary.closed += 1;
    }

    const nextAction = state.nextAction ?? '';
    const nextTransition = state.nextTransitionAt ? new Date(state.nextTransitionAt) : null;
    if (
      state.state !== 'open' &&
      nextTransition &&
      !Number.isNaN(nextTransition.getTime()) &&
      nextAction &&
      /^(Opens|Reopens)/.test(nextAction) &&
      state.millisecondsUntilTransition !== null &&
      state.millisecondsUntilTransition <= 3 * 60 * 60 * 1000
    ) {
      summary.openingWithinThreeHours += 1;
    }
  }

  summary.closedPercentage = summary.total > 0 ? Math.round((summary.closed / summary.total) * 100) : 0;
  return summary;
}

export function buildMarketDashboardModel({
  markets,
  marketStates,
  quoteEntries,
  now,
  viewerTimeZone,
  providerLabel,
}: {
  markets: MarketDefinition[];
  marketStates: Record<string, MarketClockState>;
  quoteEntries: Record<string, CachedQuoteEntry | null>;
  now: Date;
  viewerTimeZone: string;
  providerLabel: string;
}): MarketDashboardModel {
  const cards = markets.map((market) => {
    const clockState = marketStates[market.id] ?? {
      state: 'unknown',
      nextTransitionAt: null,
      previousTransitionAt: null,
      millisecondsUntilTransition: null,
      activeSession: null,
      nextSession: null,
      nextAction: null,
      holidayConfidence: 'unknown',
    };
    const quoteEntry = quoteEntries[market.id] ?? null;
    const quote = getLatestQuote(quoteEntry);
    const value = quote?.value ?? quote?.previousClose ?? null;
    const absoluteChange = quote?.absoluteChange ?? null;
    const percentageChange = quote?.percentageChange ?? null;
    const hasProviderData = quote !== null;
    const demoLabel = quote?.dataState === 'mock';
    const staleLabel = getStaleLabel(quoteEntry, clockState, now);
    const errorLabel =
      quote?.dataState === 'unavailable'
        ? 'Data unavailable'
        : staleLabel ?? (!quoteEntry ? 'No cached quote' : null);

    return {
      market,
      clockState,
      quote,
      quoteEntry,
      providerLabel,
      stateLabel: formatMarketState(clockState.state),
      valueLabel:
        value === null
          ? 'Data unavailable'
          : value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(value) ? 0 : 2 }),
      valueTone: hasProviderData ? getValueTone(absoluteChange) : 'neutral',
      absoluteChangeLabel: formatSignedNumber(absoluteChange),
      percentageChangeLabel: formatSignedPercent(percentageChange),
      dataStateLabel: quote?.dataState ?? 'cached',
      providerTimestampLabel: getLocalMarketTimestamp(quoteEntry?.providerTimestamp ?? quote?.asOf ?? null, market),
      localDisplayTimestampLabel: getDisplayTimestamp(quote?.asOf ?? quoteEntry?.providerTimestamp ?? null, viewerTimeZone),
      sessionHoursLabel: formatSessionHours(market),
      nextTransitionLabel: getNextTransitionLabel(clockState),
      countdownLabel: formatCountdown(clockState.millisecondsUntilTransition),
      cacheAgeLabel: getCacheAgeLabel(quoteEntry, now),
      errorLabel,
      demoLabel,
      staleLabel,
      marketStateTone:
        clockState.state === 'open'
          ? 'positive'
          : clockState.state === 'lunch-break'
            ? 'warning'
            : clockState.state === 'holiday'
              ? 'negative'
              : clockState.state === 'pre-market'
                ? 'warning'
                : 'neutral',
    } satisfies MarketDashboardCardModel;
  });

  const transitions = cards
    .filter((card) => card.clockState.nextTransitionAt)
    .map((card) => ({
      marketId: card.market.id,
      exchangeCode: card.market.exchangeCode,
      country: card.market.country,
      transitionAt: card.clockState.nextTransitionAt as string,
      actionLabel: `${card.market.exchangeCode} ${card.clockState.nextAction ?? 'transition'}`,
      state: card.clockState.state,
    }))
    .sort((left, right) => new Date(left.transitionAt).getTime() - new Date(right.transitionAt).getTime())
    .slice(0, 4);

  const summary = getSummaryFromStates(cards.map((card) => card.clockState));

  return {
    cards,
    transitions,
    summary,
  };
}
