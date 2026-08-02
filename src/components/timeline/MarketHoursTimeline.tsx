import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketClockState, MarketDefinition, MarketState } from '../../domain/market';
import { Countdown } from '../feedback/Countdown';
import { EmptyState } from '../feedback/EmptyState';
import { StatusBadge } from '../feedback/StatusBadge';
import { Card } from '../layout/Card';
import { classNames } from '../../utils/classNames';
import { getMarketColorStyle } from '../../styles/tokens';
import {
  buildMarketHoursTimelineModel,
  getTimelineMarketLabel,
  getTimelineSegmentAriaLabel,
  type TimelineSessionProjection,
} from '../../services/marketTimeline/marketTimeline';

const stateToneMap: Record<MarketState, 'neutral' | 'positive' | 'warning' | 'negative' | 'accent'> = {
  open: 'positive',
  closed: 'neutral',
  'pre-market': 'warning',
  'lunch-break': 'warning',
  weekend: 'neutral',
  holiday: 'negative',
  unknown: 'accent',
};

function formatMarketState(state: MarketState): string {
  return state.replace('-', ' ');
}

function formatTrackLabel(segment: TimelineSessionProjection): string {
  return `${segment.sessionLabel} ${segment.localStartLabel}–${segment.localEndLabel}`;
}

function getSelectionKeyFromModel(model: ReturnType<typeof buildMarketHoursTimelineModel>): string | null {
  const activeSegment = model.rows
    .flatMap((row) => row.segments)
    .find((segment) => segment.marketState === 'open') ?? model.rows.flatMap((row) => row.segments)[0];
  if (activeSegment) {
    return activeSegment.id;
  }
  return model.rows[0] ? `market:${model.rows[0].market.id}` : null;
}

export function MarketHoursTimeline({
  markets,
  marketStates,
  now,
  viewerTimeZone,
  density = 'comfortable',
  className,
}: {
  markets: MarketDefinition[];
  marketStates: Record<string, MarketClockState>;
  now: Date;
  viewerTimeZone: string;
  density?: 'compact' | 'comfortable';
  className?: string;
}) {
  const model = useMemo(
    () =>
      buildMarketHoursTimelineModel({
        markets,
        marketStates,
        instant: now,
        viewerTimeZone,
      }),
    [markets, marketStates, now, viewerTimeZone],
  );

  const [activeKey, setActiveKey] = useState<string | null>(() => getSelectionKeyFromModel(model));

  useEffect(() => {
    if (!activeKey) {
      setActiveKey(getSelectionKeyFromModel(model));
      return;
    }

    const hasSelection =
      model.rows.some((row) => row.segments.some((segment) => segment.id === activeKey)) ||
      model.rows.some((row) => `market:${row.market.id}` === activeKey);
    if (!hasSelection) {
      setActiveKey(getSelectionKeyFromModel(model));
    }
  }, [activeKey, model]);

  const selected = useMemo(() => {
    const segment = model.rows.flatMap((row) => row.segments).find((entry) => entry.id === activeKey) ?? null;
    if (segment) {
      return {
        type: 'segment' as const,
        segment,
        row: model.rows.find((entry) => entry.market.id === segment.marketId) ?? null,
      };
    }

    const row = model.rows.find((entry) => `market:${entry.market.id}` === activeKey) ?? model.rows[0] ?? null;
    return row ? { type: 'market' as const, row } : null;
  }, [activeKey, model.rows]);

  const sectionPadding = density === 'compact' ? 'p-4 sm:p-5' : 'p-5 sm:p-6';
  const trackMinWidth = 'min-w-[72rem]';
  const rowHeight = density === 'compact' ? 'h-12' : 'h-14';
  const rowGap = density === 'compact' ? 'gap-2.5' : 'gap-3';

  return (
    <Card className={classNames(sectionPadding, className)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Timeline</p>
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--mw-text)]">24-hour market-hours view</h2>
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--mw-text-secondary)]">
              Session bars are projected into your local timezone. Open, closed, lunch-break, and transition states stay
              aligned even when markets reorder or turn off.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={model.statusCounts.open > 0 ? 'positive' : 'neutral'}>{model.statusCounts.open} open</StatusBadge>
            <StatusBadge tone={model.statusCounts['lunch-break'] > 0 ? 'warning' : 'neutral'}>
              {model.statusCounts['lunch-break']} break
            </StatusBadge>
            <StatusBadge tone={model.statusCounts.weekend > 0 ? 'neutral' : 'neutral'}>
              {model.rows.length} enabled
            </StatusBadge>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.65fr)]">
          <div className="min-w-0 space-y-3">
            <div className="overflow-x-auto rounded-[22px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)]">
              <div className={classNames(trackMinWidth, 'p-4 sm:p-5')}>
                <div className="relative h-8 border-b border-[color:var(--mw-border)]">
                  {model.hourMarkers.map((marker) => (
                    <div
                      key={marker.hour}
                      className="absolute top-0 -translate-x-1/2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]"
                      style={{ left: `${marker.leftPercent}%` }}
                    >
                      {marker.label}
                    </div>
                  ))}
                </div>

                <div className="relative mt-4 space-y-3">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[color:var(--mw-focus)]/80 shadow-[0_0_0_1px_rgba(126,178,255,0.28)]"
                    style={{ left: `${model.currentMarkerLeftPercent}%` }}
                  />

                  {model.rows.map((row) => {
                    const rowSelectionKey = `market:${row.market.id}`;
                    const currentSegmentKey =
                      row.segments.find((segment) => segment.marketState === 'open')?.id ??
                      row.segments[0]?.id ??
                      rowSelectionKey;
                    return (
                      <div key={row.market.id} className={classNames('grid gap-3 xl:grid-cols-[13rem_minmax(0,1fr)]', rowGap)}>
                        <button
                          className={classNames(
                            'group flex flex-col items-start gap-1 rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] p-3 text-left transition',
                            'hover:border-[color:var(--mw-border-strong)] hover:bg-white/[0.03]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mw-page)]',
                            activeKey === rowSelectionKey || activeKey === currentSegmentKey
                              ? 'border-[color:var(--mw-border-strong)] bg-white/[0.04]'
                              : '',
                          )}
                          onClick={() => {
                            setActiveKey(currentSegmentKey);
                          }}
                          onFocus={() => {
                            setActiveKey(currentSegmentKey);
                          }}
                          onMouseEnter={() => {
                            setActiveKey(currentSegmentKey);
                          }}
                          type="button"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-2.5 w-2.5 rounded-full"
                              style={getMarketColorStyle(row.market.colorToken)}
                            />
                            <span className="font-semibold text-[color:var(--mw-text)]">{row.market.exchangeCode}</span>
                          </span>
                          <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                            {row.market.country}
                          </span>
                          <span className="text-sm text-[color:var(--mw-text-secondary)]">{row.market.indexName}</span>
                        </button>

                        <div className="space-y-2">
                          <div className={classNames('relative overflow-hidden rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)]', rowHeight)}>
                            <div
                              aria-hidden="true"
                              className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_0,rgba(255,255,255,0.02)_100%)]"
                            />
                            <div className="absolute inset-y-0 left-0 right-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(4.166%_-_1px),rgba(255,255,255,0.05)_calc(4.166%_-_1px),rgba(255,255,255,0.05)_4.166%)]" />

                            {row.segments.length > 0 ? (
                              row.segments.map((segment) => {
                                const isActive = activeKey === segment.id;
                                const segmentStyle: CSSProperties & { '--mw-market-accent': string } = {
                                  ...getMarketColorStyle(segment.colorToken),
                                  left: `${segment.startPercent}%`,
                                  width: `${segment.widthPercent}%`,
                                  borderColor: 'var(--mw-market-accent)',
                                  backgroundImage:
                                    'linear-gradient(90deg,color-mix(in srgb, var(--mw-market-accent) 24%, transparent), color-mix(in srgb, var(--mw-market-accent) 12%, transparent))',
                                };

                                return (
                                  <button
                                    key={segment.id}
                                    aria-label={getTimelineSegmentAriaLabel(segment)}
                                    className={classNames(
                                      'absolute top-2 z-[1] flex h-[calc(100%-1rem)] min-w-[0.75rem] items-center rounded-[14px] border px-2 text-left shadow-[var(--mw-shadow-inset)] transition',
                                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mw-page)]',
                                      isActive ? 'ring-2 ring-[color:var(--mw-focus)] ring-offset-2 ring-offset-[color:var(--mw-page)]' : '',
                                    )}
                                    onClick={() => {
                                      setActiveKey(segment.id);
                                    }}
                                    onFocus={() => {
                                      setActiveKey(segment.id);
                                    }}
                                    onMouseEnter={() => {
                                      setActiveKey(segment.id);
                                    }}
                                    style={segmentStyle}
                                    type="button"
                                  >
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--mw-text)]">
                                        {segment.sessionLabel}
                                      </span>
                                      <span className="font-mono text-[11px] tabular-nums text-[color:var(--mw-text-secondary)]">
                                        {formatTrackLabel(segment)}
                                      </span>
                                    </span>
                                    {segment.continuesBeforeDay || segment.continuesAfterDay ? (
                                      <span className="ml-auto rounded-full border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-raised)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--mw-text-muted)]">
                                        Wraps
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="absolute inset-2 flex items-center rounded-[14px] border border-dashed border-[color:var(--mw-border)] px-3 text-sm text-[color:var(--mw-text-muted)]">
                                No session intersects this local day.
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[color:var(--mw-text-secondary)]">
                            <span className="font-medium text-[color:var(--mw-text)]">{formatMarketState(row.clockState.state)}</span>
                            <span className="font-mono tabular-nums">{row.clockState.nextAction ?? 'No upcoming transition'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              aria-live="polite"
              className="rounded-[22px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Focus details</p>
                  <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">
                    {selected?.type === 'segment'
                      ? `${selected.segment.exchangeCode} ${selected.segment.sessionLabel}`
                      : selected?.row
                        ? `${selected.row.market.exchangeCode} overview`
                        : 'No selection'}
                  </h3>
                </div>
                {selected?.row ? (
                  <StatusBadge tone={stateToneMap[selected.row.clockState.state]}>{formatMarketState(selected.row.clockState.state)}</StatusBadge>
                ) : null}
              </div>

              {selected?.type === 'segment' && selected.row ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Session</p>
                    <p className="mt-2 text-base font-medium text-[color:var(--mw-text)]">{selected.segment.sessionLabel}</p>
                    <p className="mt-2 font-mono tabular-nums text-sm text-[color:var(--mw-text-secondary)]">
                      {selected.segment.localStartLabel} - {selected.segment.localEndLabel}
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--mw-text-secondary)]">
                      {selected.segment.continuesBeforeDay ? 'Starts before the local day.' : 'Starts within the local day.'}{' '}
                      {selected.segment.continuesAfterDay ? 'Continues past midnight.' : 'Ends within the local day.'}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Transition</p>
                    <p className="mt-2 text-base font-medium text-[color:var(--mw-text)]">
                      {selected.row.clockState.nextAction ?? 'No upcoming transition'}
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--mw-text-secondary)]">
                      Next transition:{' '}
                      <span className="font-mono tabular-nums text-[color:var(--mw-text)]">
                        <Countdown now={now} targetAt={selected.row.clockState.nextTransitionAt} />
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--mw-text-secondary)]">
                      State: {selected.row.clockState.state}
                    </p>
                  </div>
                </div>
              ) : selected?.row ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Market</p>
                    <p className="mt-2 text-base font-medium text-[color:var(--mw-text)]">{getTimelineMarketLabel(selected.row.market)}</p>
                    <p className="mt-2 text-sm text-[color:var(--mw-text-secondary)]">{selected.row.market.timezone}</p>
                  </div>
                  <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Next transition</p>
                    <p className="mt-2 text-base font-medium text-[color:var(--mw-text)]">
                      {selected.row.clockState.nextAction ?? 'No upcoming transition'}
                    </p>
                    <p className="mt-2 font-mono tabular-nums text-sm text-[color:var(--mw-text-secondary)]">
                      {selected.row.clockState.nextTransitionAt ?? 'n/a'}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No timeline selection"
                  description="Hover or tab into a session bar or market state row to inspect the local-time projection and next transition."
                  className="mt-4"
                />
              )}

              <p className="sr-only">{model.srSummary}</p>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-[22px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Market states</p>
                  <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Compact summary</h3>
                </div>
                <StatusBadge tone="neutral">{model.rows.length} total</StatusBadge>
              </div>

              <ul className="mt-4 space-y-2">
                {model.rows.map((row) => {
                  const tone = stateToneMap[row.clockState.state];
                  const active = activeKey === `market:${row.market.id}` || row.segments.some((segment) => segment.id === activeKey);
                  return (
                    <li key={row.market.id}>
                      <button
                        className={classNames(
                          'flex w-full items-start justify-between gap-3 rounded-[18px] border px-3 py-3 text-left transition',
                          'border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] hover:border-[color:var(--mw-border-strong)] hover:bg-white/[0.03]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mw-page)]',
                          active ? 'border-[color:var(--mw-border-strong)] bg-white/[0.04]' : '',
                        )}
                        onClick={() => {
                          setActiveKey(`market:${row.market.id}`);
                        }}
                        onFocus={() => {
                          setActiveKey(`market:${row.market.id}`);
                        }}
                        onMouseEnter={() => {
                          setActiveKey(`market:${row.market.id}`);
                        }}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={getMarketColorStyle(row.market.colorToken)} />
                            <span className="font-medium text-[color:var(--mw-text)]">{row.market.exchangeCode}</span>
                          </span>
                          <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                            {row.market.country}
                          </span>
                          <span className="mt-1 block text-sm text-[color:var(--mw-text-secondary)]">
                            {row.clockState.nextAction ?? 'No upcoming transition'}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge tone={tone}>{formatMarketState(row.clockState.state)}</StatusBadge>
                          <span className="font-mono text-[11px] tabular-nums text-[color:var(--mw-text-muted)]">
                            Next <Countdown now={now} targetAt={row.clockState.nextTransitionAt} />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-[22px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4 sm:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Legend</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone="positive">Open</StatusBadge>
                <StatusBadge tone="warning">Pre-market</StatusBadge>
                <StatusBadge tone="warning">Lunch break</StatusBadge>
                <StatusBadge tone="neutral">Closed</StatusBadge>
                <StatusBadge tone="negative">Holiday</StatusBadge>
                <StatusBadge tone="accent">Unknown</StatusBadge>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Card>
  );
}
