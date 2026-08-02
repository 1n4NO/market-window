import { formatInTimeZone } from 'date-fns-tz';
import type { MarketDashboardCardModel } from '../../services/marketDashboard/marketDashboard';
import { classNames } from '../../utils/classNames';
import { Card } from '../layout/Card';
import { StatusBadge } from '../feedback/StatusBadge';
import { MarketFlagIcon } from './MarketFlags';

const stateToneMap = {
  open: 'positive',
  closed: 'negative',
  'pre-market': 'accent',
  'lunch-break': 'warning',
  weekend: 'neutral',
  holiday: 'negative',
  unknown: 'accent',
} as const;

const countryLabelMap: Record<string, string> = {
  nse: 'India',
  tse: 'Japan',
  lse: 'UK',
  nyse: 'US',
  hkex: 'HK',
  xetra: 'Germany',
};

function getStateBadgeLabel(card: MarketDashboardCardModel): string {
  switch (card.clockState.state) {
    case 'open':
      return 'OPEN';
    case 'closed':
      return 'CLOSED';
    case 'pre-market':
      return 'OPENS SOON';
    case 'lunch-break':
      return 'ON BREAK';
    case 'weekend':
      return 'WEEKEND';
    case 'holiday':
      return 'HOLIDAY';
    default:
      return 'UNKNOWN';
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

function getRelativeTransitionLabel(now: Date, timeZone: string, transitionAt: string): string {
  const transition = new Date(transitionAt);
  if (Number.isNaN(transition.getTime())) {
    return 'Soon';
  }

  const today = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
  const tomorrow = formatInTimeZone(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone, 'yyyy-MM-dd');
  const transitionDay = formatInTimeZone(transition, timeZone, 'yyyy-MM-dd');
  const timeLabel = formatInTimeZone(transition, timeZone, 'HH:mm');

  if (transitionDay === today) {
    return `Today · ${timeLabel}`;
  }

  if (transitionDay === tomorrow) {
    return `Tomorrow · ${timeLabel}`;
  }

  return `${formatInTimeZone(transition, timeZone, 'EEEE')} · ${timeLabel}`;
}

function getSessionFooterLabel(card: MarketDashboardCardModel): string {
  const { state } = card.clockState;
  const session =
    state === 'lunch-break'
      ? card.clockState.nextSession ?? card.clockState.activeSession
      : card.clockState.activeSession ?? card.clockState.nextSession;

  if (!session) {
    return 'Regular Session';
  }

  if (state === 'lunch-break') {
    const zone = getTimeZoneAbbreviation(card.market.timezone);
    return `${session.openTime}–${session.closeTime} ${zone}`.trim();
  }

  return session.label || 'Regular Session';
}

function formatCloseValue(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
}

export function MarketCard({
  card,
  now,
}: {
  card: MarketDashboardCardModel;
  now: Date;
}) {
  const hasQuoteValue = card.quote?.value !== null && card.quote?.value !== undefined;
  const stateTone = stateToneMap[card.clockState.state];
  const closeValue = formatCloseValue(card.quote?.previousClose ?? card.quote?.value ?? null);
  const transitionLabel =
    card.clockState.nextTransitionAt !== null
      ? getRelativeTransitionLabel(now, card.market.timezone, card.clockState.nextTransitionAt)
      : 'Soon';
  const sessionLabel = getSessionFooterLabel(card);

  return (
    <Card
      as="article"
      aria-label={`${card.market.exchangeCode} ${card.market.indexName} market card`}
      className="h-[309px] overflow-hidden p-4 transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-[color:var(--mw-border-strong)] hover:shadow-[var(--mw-shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mw-page)]"
      tabIndex={0}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-[30px] w-[30px] shrink-0 overflow-hidden rounded-full border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] shadow-[var(--mw-shadow-inset)]">
              <MarketFlagIcon marketId={card.market.id} className="h-full w-full" />
            </span>
              <p className="min-w-0 truncate text-[18px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--mw-text)]">
              {card.market.exchangeCode}{' '}
              <span className="text-[14px] font-normal text-[color:var(--mw-text-secondary)] opacity-70">
                ({countryLabelMap[card.market.id] ?? card.market.country})
              </span>
            </p>
          </div>

          {card.clockState.state === 'weekend' ? (
            <span className="inline-flex items-center rounded-full border border-[color:var(--mw-border)]/55 bg-[color:var(--mw-panel-inset)] px-2 py-[1px] text-[9px] font-medium uppercase tracking-[0.12em] text-[color:var(--mw-text-muted)]">
              {getStateBadgeLabel(card)}
            </span>
          ) : (
            <StatusBadge tone={stateTone}>{getStateBadgeLabel(card)}</StatusBadge>
          )}
        </div>

        <div className="mt-4">
          <h3 className="truncate text-[18px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--mw-text)]">
            {card.market.indexName}
          </h3>
          <div className="mt-3">
            <p className="text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[color:var(--mw-text)]">
              {hasQuoteValue ? card.valueLabel : '—'}
            </p>
            {hasQuoteValue ? (
              <p
                className={classNames(
                  'mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] font-medium tabular-nums',
                  card.valueTone === 'positive'
                    ? 'text-[color:var(--mw-positive)]'
                    : card.valueTone === 'negative'
                      ? 'text-[color:var(--mw-negative)]'
                  : 'text-[color:var(--mw-text-secondary)]',
                )}
              >
                <span>{card.absoluteChangeLabel}</span>
                <span>{card.percentageChangeLabel}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 min-h-[68px] space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--mw-text-muted)]">Latest quote</p>
          {hasQuoteValue ? (
            <>
              <p className="text-[16px] font-medium leading-none tabular-nums text-[color:var(--mw-text-secondary)]">
                {closeValue ?? 'Unavailable'}
              </p>
              <p className="text-[12px] leading-4 text-[color:var(--mw-text-muted)]">{card.localDisplayTimestampLabel}</p>
            </>
          ) : (
            <p className="text-[13px] leading-4 text-[color:var(--mw-text-muted)]">Unavailable</p>
          )}
        </div>

        <div className="mt-auto border-t border-[color:rgba(255,255,255,0.10)] pt-3">
          <div className="flex h-[98px] flex-col justify-start gap-[4px]">
            <p className="whitespace-nowrap text-[13px] font-medium leading-[1.35] text-[color:var(--mw-text-secondary)]">
              Next session
            </p>
            <p className="whitespace-nowrap text-[18px] font-semibold leading-[1.15] text-[color:var(--mw-market-us)]">
              {transitionLabel}
            </p>
            <p className="whitespace-nowrap text-[11px] font-normal uppercase tracking-[0.08em] leading-[1.35] text-[color:var(--mw-text-muted)]/60">
              {sessionLabel}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
