import type { QuickLink } from '../../domain/market';
import type { MarketSummaryModel, MarketTransitionItem } from '../../services/marketDashboard/marketDashboard';
import { formatInTimeZone } from 'date-fns-tz';
import { Clock3, ChevronRight, Info, Lightbulb } from 'lucide-react';
import { Countdown } from '../feedback/Countdown';
import { Card } from '../layout/Card';
import { getMarketDefinition } from '../../config/markets';
import { getMarketColorStyle } from '../../styles/tokens';

const CITY_LABELS: Record<string, string> = {
  nse: 'Mumbai',
  tse: 'Tokyo',
  lse: 'London',
  nyse: 'New York',
  hkex: 'Hong Kong',
  xetra: 'Frankfurt',
};

export function UpcomingTransitionsPanel({
  transitions,
  now,
}: {
  transitions: MarketTransitionItem[];
  now: Date;
}) {
  const openingTransitions = transitions
    .filter((transition) => {
      const actionText = transition.actionLabel.replace(/^[A-Z]+\s+/, '');
      return /^Opens\b|^Reopens\b/.test(actionText);
    })
    .sort((left, right) => new Date(left.transitionAt).getTime() - new Date(right.transitionAt).getTime())
    .slice(0, 4);

  return (
    <Card className="flex h-[228px] flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--mw-text-muted)]">UPCOMING OPENS</p>
      </div>

      {openingTransitions.length > 0 ? (
        <ol className="mt-3 divide-y divide-[rgba(255,255,255,0.05)]">
          {openingTransitions.map((transition) => {
            const market = getMarketDefinition(transition.marketId);
            const city = CITY_LABELS[transition.marketId] ?? transition.country;
            const timeZone = market?.timezone ?? 'UTC';
            const openedAt = formatInTimeZone(new Date(transition.transitionAt), timeZone, 'h:mm a zzz');

            return (
              <li
                key={`${transition.marketId}-${transition.transitionAt}`}
                className="grid h-[46px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-1.5 first:pt-0 first:pb-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={
                      market
                        ? {
                            ...getMarketColorStyle(market.colorToken),
                            backgroundColor: 'var(--mw-market-accent)',
                            boxShadow: '0 0 0 3px color-mix(in srgb, var(--mw-market-accent) 14%, transparent)',
                          }
                        : {
                            backgroundColor: 'var(--mw-market-us)',
                            boxShadow: '0 0 0 3px color-mix(in srgb, var(--mw-market-us) 14%, transparent)',
                          }
                    }
                  />
                  <p className="truncate text-[12.5px] font-medium leading-4 text-[color:var(--mw-text)]">
                    {city} ({transition.exchangeCode})
                  </p>
                </div>

                <p className="whitespace-nowrap text-[13px] font-medium leading-4 text-[color:var(--mw-text-secondary)]">
                  {openedAt}
                </p>

                <div className="flex items-center gap-1.5 whitespace-nowrap text-[12px] leading-4 text-[color:var(--mw-text-muted)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>in</span>
                  <Countdown now={now} targetAt={transition.transitionAt} />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-3 text-[12px] leading-5 text-[color:var(--mw-text-muted)]">
          No upcoming opening events are currently available.
        </div>
      )}

      <div className="mt-auto pt-3">
        <div className="flex items-center justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-[color:var(--mw-text-secondary)]/80 transition hover:text-[color:var(--mw-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mw-page)]"
          >
            View all markets
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

export function MarketSummaryPanel({
  summary,
}: {
  summary: MarketSummaryModel;
}) {
  const closedPercent = Math.max(0, Math.min(100, summary.closedPercentage));
  return (
    <Card className="flex h-[228px] flex-col p-4">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--mw-text-muted)]">MARKET SUMMARY</p>
        <Info className="h-3.5 w-3.5 text-[color:var(--mw-text-muted)]" aria-hidden="true" />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-0">
        <Metric label="Open" value={summary.open} tone="positive" />
        <Metric label="Closed" value={summary.closed} tone="negative" />
        <Metric label="Opens Soon" value={summary.openingWithinThreeHours} tone="accent" />
        <Metric label="Total" value={summary.total} tone="neutral" />
      </div>

      <div className="mt-3 grid flex-1 items-center gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <div
          aria-label={`Closed markets represent ${closedPercent}% of enabled markets`}
          className="relative flex h-[90px] w-[90px] shrink-0 items-center justify-center rounded-full border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)]"
          style={{
            background: `conic-gradient(var(--mw-negative) 0 ${closedPercent}%, rgba(255,255,255,0.05) ${closedPercent}% 100%)`,
          }}
        >
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] text-center">
            <div>
              <p className="text-[17px] font-semibold leading-none text-[color:var(--mw-text)]">{closedPercent}%</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-[color:var(--mw-text-muted)]">closed</p>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          <p className="text-[16px] font-medium leading-5 text-[color:var(--mw-text)]">
            {closedPercent}% of tracked markets are closed.
          </p>
          <p className="text-[13px] leading-5 text-[color:var(--mw-text-secondary)]">
            {summary.closed} of {summary.total} markets
          </p>
          <p className="text-[13px] leading-5 text-[color:var(--mw-text-secondary)]">
            Next open: Tokyo (TSE)
          </p>
        </div>
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'positive' | 'negative' | 'accent' | 'neutral';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-[color:var(--mw-positive)]'
      : tone === 'negative'
        ? 'text-[color:var(--mw-negative)]'
        : tone === 'accent'
          ? 'text-[color:#6ea8ff]'
          : 'text-[color:var(--mw-text)]';

  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:border-l sm:border-[color:var(--mw-border)] sm:first:border-l-0 sm:first:pl-0 sm:pl-3">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--mw-text-muted)]">{label}</p>
      <p className={`mt-1 text-[32px] font-semibold leading-none tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

export function QuickLinksPanel({
  quickLinks,
  visible,
}: {
  quickLinks: QuickLink[];
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  const visibleLinks = quickLinks
    .filter((link) => link.enabled)
    .sort((left, right) => left.order - right.order)
    .slice(0, 4);

  return (
    <Card className="flex h-[228px] flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--mw-text-muted)]">QUICK LINKS</p>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2.5">
        {visibleLinks.map((link) => (
          <a
            key={link.id}
            className="group flex min-w-0 flex-col items-center gap-1.5 rounded-[14px] px-1 py-2 text-center transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mw-page)]"
            href={link.url}
          >
            <span
              aria-hidden="true"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--mw-text)] shadow-[var(--mw-shadow-inset)]"
            >
              {getQuickLinkMark(link)}
            </span>
            <span className="w-full truncate text-[13px] font-medium leading-4 text-[color:var(--mw-text-secondary)]">
              {link.label}
            </span>
          </a>
        ))}
      </div>

      <div className="mt-auto border-t border-[color:rgba(255,255,255,0.10)] pt-3">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--mw-text-muted)]" aria-hidden="true" />
          <p className="text-[11px] leading-4 text-[color:var(--mw-text-muted)]">
            Select any market card to view today&apos;s session details.
          </p>
        </div>
      </div>
    </Card>
  );
}

function getQuickLinkMark(link: QuickLink): string {
  const normalized = link.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (normalized.includes('investing')) {
    return 'IN';
  }
  if (normalized.includes('tradingview')) {
    return 'TV';
  }
  if (normalized.includes('marketwatch')) {
    return 'MW';
  }
  if (normalized.includes('yahoo')) {
    return 'YF';
  }
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return '•';
}
