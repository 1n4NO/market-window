import type { MarketDashboardCardModel } from '../../services/marketDashboard/marketDashboard';
import { Countdown } from '../feedback/Countdown';
import { DataStateLabel } from '../feedback/DataStateLabel';
import { ErrorNotice } from '../feedback/ErrorNotice';
import { StatusBadge } from '../feedback/StatusBadge';
import { Card } from '../layout/Card';
import { classNames } from '../../utils/classNames';
import { getMarketColorStyle } from '../../styles/tokens';

const stateToneMap = {
  open: 'positive',
  closed: 'neutral',
  'pre-market': 'warning',
  'lunch-break': 'warning',
  weekend: 'neutral',
  holiday: 'negative',
  unknown: 'accent',
} as const;

function formatValue(value: string): string {
  return value === 'Data unavailable' ? value : value;
}

export function MarketCard({
  card,
  now,
}: {
  card: MarketDashboardCardModel;
  now: Date;
}) {
  return (
    <Card
      as="article"
      aria-label={`${card.market.exchangeCode} market card`}
      className="p-4 sm:p-5"
      tabIndex={0}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--mw-text)]"
                style={getMarketColorStyle(card.market.colorToken)}
              >
                {card.market.iconId.replace(/^flag-/, '').toUpperCase()}
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">{card.market.exchangeCode}</p>
                <h3 className="text-lg font-semibold tracking-tight text-[color:var(--mw-text)]">{card.market.indexName}</h3>
              </div>
            </div>
            <p className="text-sm text-[color:var(--mw-text-secondary)]">{card.market.country}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge tone={stateToneMap[card.clockState.state]}>{card.stateLabel}</StatusBadge>
            <DataStateLabel state={card.dataStateLabel} />
            {card.demoLabel ? <StatusBadge tone="neutral">Demo data</StatusBadge> : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">
              {card.clockState.state === 'open'
                ? 'Latest provider value'
                : card.clockState.state === 'lunch-break'
                  ? 'On break'
                  : 'Latest available closing value'}
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-3xl tabular-nums text-[color:var(--mw-text)]">
                  {formatValue(card.valueLabel)}
                </p>
                <p
                  className={classNames(
                    'mt-2 font-mono text-sm tabular-nums',
                    card.valueTone === 'positive'
                      ? 'text-[color:var(--mw-positive)]'
                      : card.valueTone === 'negative'
                        ? 'text-[color:var(--mw-negative)]'
                        : 'text-[color:var(--mw-text-secondary)]',
                  )}
                >
                  <span className="sr-only">Absolute change</span>
                  {card.absoluteChangeLabel} <span className="mx-1">|</span> {card.percentageChangeLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Countdown</p>
                <p className="mt-1 font-mono text-sm tabular-nums text-[color:var(--mw-text)]">
                  <Countdown now={now} targetAt={card.clockState.nextTransitionAt} />
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Session hours</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--mw-text-secondary)]">{card.sessionHoursLabel}</p>
            </div>
            <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Next transition</p>
              <p className="mt-2 text-sm font-medium text-[color:var(--mw-text)]">{card.nextTransitionLabel}</p>
              <p className="mt-2 font-mono text-xs tabular-nums text-[color:var(--mw-text-secondary)]">
                <Countdown now={now} targetAt={card.clockState.nextTransitionAt} />
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Provider timestamp</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--mw-text-secondary)]">{card.providerTimestampLabel}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">
                {card.cacheAgeLabel ?? card.providerLabel}
              </p>
            </div>
            <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Local display</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--mw-text-secondary)]">{card.localDisplayTimestampLabel}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">{card.countdownLabel}</p>
            </div>
          </div>

          <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Status</p>
              <span className="font-mono text-xs tabular-nums text-[color:var(--mw-text-muted)]">
                {card.clockState.nextAction ?? 'No transition scheduled'}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {card.cacheAgeLabel ? <StatusBadge tone="neutral">{card.cacheAgeLabel}</StatusBadge> : null}
              {card.staleLabel ? <StatusBadge tone="warning">{card.staleLabel}</StatusBadge> : null}
              {card.errorLabel ? <ErrorNotice className="w-full" title="Data issue" message={card.errorLabel} /> : null}
              {!card.errorLabel && card.clockState.state === 'lunch-break' ? (
                <StatusBadge tone="warning">On break</StatusBadge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
