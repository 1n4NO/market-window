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

function formatCompactValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
}

function buildSparklinePath(values: number[]): string {
  if (values.length === 0) {
    return '';
  }
  if (values.length === 1) {
    return 'M 0 20 L 110 20';
  }

  const width = 110;
  const height = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const normalized = (value - min) / range;
      const y = height - normalized * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function MarketSparkline({
  values,
  tone,
  idSuffix,
}: {
  values: number[];
  tone: 'positive' | 'negative' | 'neutral' | 'warning';
  idSuffix: string;
}) {
  if (values.length < 2) {
    return null;
  }

  const start = values[0];
  const end = values[values.length - 1];
  const fillColor =
    tone === 'positive'
      ? 'rgba(71, 214, 148, 0.18)'
      : tone === 'negative'
        ? 'rgba(255, 108, 108, 0.18)'
        : 'rgba(111, 160, 255, 0.16)';
  const strokeColor =
    tone === 'positive'
      ? 'rgba(71, 214, 148, 0.95)'
      : tone === 'negative'
        ? 'rgba(255, 108, 108, 0.95)'
        : 'rgba(111, 160, 255, 0.95)';
  const path = buildSparklinePath(values);
  const linePath = `${path} L 110 36 L 0 36 Z`;
  const strokeGradientId = `market-sparkline-stroke-${idSuffix}`;
  const fillGradientId = `market-sparkline-fill-${idSuffix}`;

  return (
    <div className="flex flex-col items-end gap-1">
      <svg
        aria-label={`Intraday sparkline from ${formatCompactValue(start)} to ${formatCompactValue(end)}`}
        className="h-[40px] w-[108px] shrink-0"
        viewBox="0 0 110 40"
        fill="none"
        role="img"
      >
        <defs>
          <linearGradient id={strokeGradientId} x1="0" x2="110" y1="0" y2="0">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="1" />
          </linearGradient>
          <linearGradient id={fillGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fillColor} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>
        <path d={linePath} fill={`url(#${fillGradientId})`} />
        <path d={path} stroke={`url(#${strokeGradientId})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
      <p className="text-[10px] leading-none text-[color:var(--mw-text-muted)]">Intraday</p>
    </div>
  );
}

export function MarketCard({
  card,
  now,
}: {
  card: MarketDashboardCardModel;
  now: Date;
}) {
  const hasQuoteValue = card.quote?.value !== null && card.quote?.value !== undefined;
  const hasSeries = Array.isArray(card.quote?.intradaySeries) && (card.quote?.intradaySeries?.length ?? 0) > 1;
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
      className="relative h-[318px] overflow-hidden p-4 transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-[color:var(--mw-border-strong)] hover:shadow-[var(--mw-shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mw-page)]"
      tabIndex={0}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-3 pr-20">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-[30px] w-[30px] shrink-0 overflow-hidden rounded-full border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] shadow-[var(--mw-shadow-inset)]">
              <MarketFlagIcon marketId={card.market.id} className="h-full w-full" />
            </span>
            <div className="min-w-0 pt-[1px]">
              <p className="whitespace-nowrap text-[18px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--mw-text)]">
                {card.market.exchangeCode}{' '}
                <span className="text-[14px] font-normal text-[color:var(--mw-text-secondary)] opacity-70">
                  ({countryLabelMap[card.market.id] ?? card.market.country})
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute right-4 top-4">
          <StatusBadge tone={stateTone}>{getStateBadgeLabel(card)}</StatusBadge>
        </div>

        <div className="mt-3">
          <h3 className="truncate text-[18px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--mw-text)]">
            {card.market.indexName}
          </h3>
          <div className="mt-2.5">
            <p className="text-[31px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[color:var(--mw-text)]">
              {hasQuoteValue ? card.valueLabel : '—'}
            </p>
            {hasQuoteValue ? (
              <p
                className={classNames(
                  'mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] font-medium tabular-nums',
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

        <div className="mt-2 min-h-[84px]">
          <div className="relative pr-20">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--mw-text-muted)]">Latest quote</p>
            {card.demoLabel ? (
              <div className="pointer-events-none absolute right-0 top-[-2px]">
                <StatusBadge tone="accent">DEMO</StatusBadge>
              </div>
            ) : null}
          </div>
          {hasQuoteValue ? (
            <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_126px] gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                  <p className="text-[15px] font-medium leading-none tabular-nums text-[color:var(--mw-text-secondary)]">
                    {closeValue ?? 'Unavailable'}
                  </p>
                  {hasSeries ? null : (
                    <p className="text-[12px] leading-4 text-[color:var(--mw-text-muted)]">{card.localDisplayTimestampLabel}</p>
                  )}
                </div>
                {card.quote?.dayHigh !== undefined || card.quote?.dayLow !== undefined ? (
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] leading-4 text-[color:var(--mw-text-muted)]">
                    {card.quote?.dayHigh !== undefined && card.quote?.dayHigh !== null ? (
                      <span className="whitespace-nowrap">
                        High <span className="text-[color:var(--mw-text-secondary)]">{formatCompactValue(card.quote.dayHigh)}</span>
                      </span>
                    ) : null}
                    {card.quote?.dayLow !== undefined && card.quote?.dayLow !== null ? (
                      <span className="whitespace-nowrap">
                        Low <span className="text-[color:var(--mw-text-secondary)]">{formatCompactValue(card.quote.dayLow)}</span>
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {hasSeries ? (
                  <p className="mt-1.5 text-[12px] leading-4 text-[color:var(--mw-text-muted)]">{card.localDisplayTimestampLabel}</p>
                ) : null}
              </div>
              <div className="flex justify-end">
                {hasSeries ? (
                  <MarketSparkline
                    idSuffix={card.market.id}
                    tone={card.valueTone}
                    values={card.quote?.intradaySeries ?? []}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-1.5 flex min-h-[44px] items-start">
              <p className="text-[13px] leading-4 text-[color:var(--mw-text-muted)]">Unavailable</p>
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-[color:rgba(255,255,255,0.08)] pt-2.5">
          <div className="flex h-[66px] flex-col justify-start gap-[1px]">
            <p className="whitespace-nowrap text-[12px] font-medium leading-[1.3] text-[color:var(--mw-text-secondary)]">
              Next session · <span className="text-[18px] font-semibold leading-[1.1] text-[color:var(--mw-market-us)]">{transitionLabel}</span>
            </p>
            <p className="whitespace-nowrap text-[11px] font-normal uppercase tracking-[0.08em] leading-[1.25] text-[color:var(--mw-text-muted)]/60">
              {sessionLabel}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
