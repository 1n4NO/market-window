import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { addMinutes } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { Info } from 'lucide-react';
import type { MarketClockState, MarketDefinition, MarketState, SessionDefinition } from '../../domain/market';
import { Card } from '../layout/Card';
import { classNames } from '../../utils/classNames';
import {
  buildMarketHoursTimelineModel,
  type TimelineMarketRow,
  type TimelineSessionProjection,
} from '../../services/marketTimeline/marketTimeline';

const MARKET_ACCENTS: Record<string, string> = {
  nse: '#d8a15d',
  tse: '#a78bfa',
  lse: '#6ea8ff',
  nyse: '#73d98b',
  hkex: '#e38bb2',
  xetra: '#8fb5ff',
};

const CITY_LABELS: Record<string, string> = {
  nse: 'Mumbai',
  tse: 'Tokyo',
  lse: 'London',
  nyse: 'New York',
  hkex: 'Hong Kong',
  xetra: 'Frankfurt',
};

function formatMarketState(state: MarketState): string {
  switch (state) {
    case 'open':
      return 'Open';
    case 'pre-market':
      return 'Pre-market';
    case 'lunch-break':
      return 'On break';
    case 'weekend':
      return 'Weekend';
    case 'holiday':
      return 'Holiday';
    case 'closed':
      return 'Closed';
    default:
      return 'Unknown';
  }
}

function getTimeZoneAbbreviation(instant: Date, timeZone: string): string {
  if (timeZone === 'Asia/Kolkata') {
    return 'IST';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  });
  return formatter.formatToParts(instant).find((part) => part.type === 'timeZoneName')?.value ?? '';
}

function getTimelineSummaryText(row: TimelineMarketRow): string {
  if (row.clockState.state === 'weekend') {
    return 'Weekend';
  }
  if (row.clockState.state === 'holiday') {
    return 'Holiday';
  }
  if (row.clockState.state === 'lunch-break') {
    return row.clockState.nextAction ?? 'On break';
  }
  if (row.clockState.state === 'open') {
    return row.clockState.nextAction ?? 'Open';
  }
  return row.clockState.nextAction ?? formatMarketState(row.clockState.state);
}

function getMarketAccentColor(marketId: string): string {
  return MARKET_ACCENTS[marketId] ?? '#8fb5ff';
}

function formatExchangeSessionLabel(market: MarketDefinition, session: SessionDefinition, instant: Date): string {
  return `${CITY_LABELS[market.id] ?? market.country} (${market.exchangeCode}) ${session.openTime}–${session.closeTime} ${getTimeZoneAbbreviation(
    instant,
    market.timezone,
  )}`;
}

function parseTimeParts(time: string): { hour: number; minute: number } {
  const [hourText, minuteText] = time.split(':');
  return {
    hour: Number(hourText),
    minute: Number(minuteText),
  };
}

function getSessionDurationMinutes(session: SessionDefinition): number {
  const open = parseTimeParts(session.openTime);
  const close = parseTimeParts(session.closeTime);
  const openMinutes = open.hour * 60 + open.minute;
  const closeMinutes = close.hour * 60 + close.minute;
  const duration = closeMinutes - openMinutes;
  return duration > 0 ? duration : duration + 1440;
}

function getMinutesSinceLocalMidnight(instant: Date, timeZone: string): number {
  const zoned = toZonedTime(instant, timeZone);
  return zoned.getHours() * 60 + zoned.getMinutes() + zoned.getSeconds() / 60 + zoned.getMilliseconds() / 60000;
}

function formatLocalTime(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'h:mm a zzz');
}

function getProjectedGhostSegment(
  row: TimelineMarketRow,
  viewerTimeZone: string,
): TimelineSessionProjection | null {
  const nextTransitionAt = row.clockState.nextTransitionAt ? new Date(row.clockState.nextTransitionAt) : null;
  const nextSession = row.clockState.nextSession ?? row.market.sessions[0] ?? null;

  if (!nextTransitionAt || Number.isNaN(nextTransitionAt.getTime()) || !nextSession) {
    return null;
  }

  const projectedEndAt = addMinutes(nextTransitionAt, getSessionDurationMinutes(nextSession));
  const startMinute = getMinutesSinceLocalMidnight(nextTransitionAt, viewerTimeZone);
  const endMinute = getMinutesSinceLocalMidnight(projectedEndAt, viewerTimeZone);
  const clampedEndMinute = endMinute <= startMinute ? Math.min(1440, startMinute + 90) : endMinute;
  const widthPercent = Math.max(0.15, ((clampedEndMinute - startMinute) / 1440) * 100);

  return {
    id: `${row.market.id}:projection:${row.clockState.state}`,
    marketId: row.market.id,
    exchangeCode: row.market.exchangeCode,
    country: row.market.country,
    indexName: row.market.indexName,
    iconId: row.market.iconId,
    colorToken: row.market.colorToken,
    marketState: row.clockState.state,
    nextTransitionAt: row.clockState.nextTransitionAt,
    nextAction: row.clockState.nextAction,
    sessionId: nextSession.id,
    sessionLabel: `${nextSession.label} projection`,
    startAt: nextTransitionAt.toISOString(),
    endAt: projectedEndAt.toISOString(),
    startMinute,
    endMinute: clampedEndMinute,
    startPercent: (startMinute / 1440) * 100,
    endPercent: (clampedEndMinute / 1440) * 100,
    widthPercent,
    continuesBeforeDay: false,
    continuesAfterDay: false,
    localStartLabel: formatLocalTime(nextTransitionAt, viewerTimeZone),
    localEndLabel: formatLocalTime(projectedEndAt, viewerTimeZone),
  };
}

function getVisibleSegments(row: TimelineMarketRow, viewerTimeZone: string): TimelineSessionProjection[] {
  if (row.segments.length > 0) {
    return row.segments;
  }

  const projected = getProjectedGhostSegment(row, viewerTimeZone);
  return projected ? [projected] : [];
}

function getSelectionKeyFromRows(rows: RenderedTimelineRow[]): string | null {
  const activeSegment = rows
    .flatMap((row) => row.segments)
    .find((segment) => segment.marketState === 'open') ?? rows.flatMap((row) => row.segments)[0];
  if (activeSegment) {
    return activeSegment.id;
  }
  return rows[0] ? `market:${rows[0].row.market.id}` : null;
}

interface RenderedTimelineRow {
  row: TimelineMarketRow;
  segments: TimelineSessionProjection[];
}

function buildSegmentStyle(segment: TimelineSessionProjection): CSSProperties & { '--mw-market-accent': string } {
  return {
    '--mw-market-accent': getMarketAccentColor(segment.marketId),
    left: `${segment.startPercent}%`,
    width: `${segment.widthPercent}%`,
    backgroundColor: 'color-mix(in srgb, var(--mw-market-accent) 22%, rgba(255,255,255,0.03))',
    borderColor: 'color-mix(in srgb, var(--mw-market-accent) 68%, transparent)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
  };
}

export function MarketHoursTimeline({
  markets,
  marketStates,
  now,
  viewerTimeZone,
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

  const renderedRows = useMemo<RenderedTimelineRow[]>(
    () =>
      model.rows.map((row) => ({
        row,
        segments: getVisibleSegments(row, viewerTimeZone),
      })),
    [model.rows, viewerTimeZone],
  );

  const [activeKey, setActiveKey] = useState<string | null>(() => getSelectionKeyFromRows(renderedRows));

  useEffect(() => {
    if (!activeKey) {
      setActiveKey(getSelectionKeyFromRows(renderedRows));
      return;
    }

    const hasSelection =
      renderedRows.some((row) => row.segments.some((segment) => segment.id === activeKey)) ||
      renderedRows.some((row) => `market:${row.row.market.id}` === activeKey);

    if (!hasSelection) {
      setActiveKey(getSelectionKeyFromRows(renderedRows));
    }
  }, [activeKey, renderedRows]);

  const sectionPadding = 'p-[21px]';
  const hasProjectedSessions = renderedRows.some(({ segments }) => segments.some((segment) => segment.sessionLabel.endsWith('projection')));
  const currentTimeLabel = formatInTimeZone(now, viewerTimeZone, 'h:mm a zzz');
  const hourScaleHours = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <Card className={classNames('h-[264px] overflow-hidden rounded-[14px]', sectionPadding, className)}>
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[color:var(--mw-text-muted)]">MARKET HOURS (LOCAL TIME)</p>
          {hasProjectedSessions ? <p className="text-[11px] text-[color:var(--mw-text-muted)]">Weekend projection</p> : null}
        </div>

          <div className="grid flex-1 min-h-0 gap-6 min-[1050px]:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 flex min-h-0 flex-col">
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="grid grid-cols-[repeat(9,minmax(0,1fr))] border-b border-[color:rgba(147,166,197,0.10)] pb-1.5 text-[11px] leading-none text-[color:var(--mw-text-muted)]">
                {hourScaleHours.map((hour) => {
                  const normalized = hour % 24;
                  let label = '12 AM';
                  if (normalized === 12) {
                    label = '12 PM';
                  } else if (normalized !== 0) {
                    const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
                    label = `${hour12} ${normalized < 12 ? 'AM' : 'PM'}`;
                  }

                  return (
                    <div key={hour} className="justify-self-start">
                      {label}
                    </div>
                  );
                })}
              </div>

              <div className="relative mt-2 flex-1 min-h-0 pb-8">
                <div
                  aria-label={`Current local time marker at ${currentTimeLabel}`}
                  className="pointer-events-none absolute top-0 bottom-[26px] z-20 w-px bg-[color:#f25f63] shadow-[0_0_0_1px_rgba(242,95,99,0.4)]"
                  role="img"
                  style={{ left: `${model.currentMarkerLeftPercent}%` }}
                >
                  <span className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[color:#f25f63] shadow-[0_0_0_2px_rgba(242,95,99,0.18)]" />
                </div>

                <div className="space-y-1.5 pt-1">
                  {renderedRows.map(({ row, segments }) => {
                    return (
                      <div key={row.market.id} className="grid h-[32px] grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium leading-4 text-[color:var(--mw-text)]">
                            {CITY_LABELS[row.market.id] ?? row.market.country}
                          </p>
                        </div>

                        <div className="relative h-[26px] overflow-hidden rounded-[7px] bg-[rgba(255,255,255,0.012)]">
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(4.166%_-_1px),rgba(255,255,255,0.018)_calc(4.166%_-_1px),rgba(255,255,255,0.018)_4.166%)]" />

                          {segments.length > 0 ? (
                            segments.map((segment) => {
                              const isActive = activeKey === segment.id;
                              const isProjected = segment.sessionLabel.endsWith('projection');
                              const segmentStyle = buildSegmentStyle(segment);
                              const session = row.market.sessions.find((entry) => entry.id === segment.sessionId) ?? row.market.sessions[0] ?? null;
                              const viewerProjection = `${formatInTimeZone(new Date(segment.startAt), viewerTimeZone, 'h:mm a zzz')} – ${formatInTimeZone(
                                new Date(segment.endAt),
                                viewerTimeZone,
                                'h:mm a zzz',
                              )}`;
                              const exchangeLabel = session
                                ? formatExchangeSessionLabel(row.market, session, new Date(segment.startAt))
                                : `${CITY_LABELS[segment.marketId] ?? segment.country} (${segment.exchangeCode})`;
                              const accessibleLabel = session
                                ? `${exchangeLabel}. Your time: ${viewerProjection}. Status: ${isProjected ? 'Weekend projection' : formatMarketState(row.clockState.state)}`
                                : `${CITY_LABELS[segment.marketId] ?? segment.country} (${segment.exchangeCode}). Your time: ${viewerProjection}. Status: ${isProjected ? 'Weekend projection' : formatMarketState(row.clockState.state)}`;
                              const barLabel = segment.widthPercent > 10 ? `${segment.exchangeCode} ${session ? `${session.openTime}–${session.closeTime}` : ''}`.trim() : segment.exchangeCode;
                              return (
                                <button
                                  key={segment.id}
                                  aria-label={accessibleLabel}
                                  title={`${accessibleLabel}`}
                                  className={classNames(
                                    'absolute top-[3px] z-[1] flex h-[20px] min-w-[0.75rem] items-center rounded-[6px] border px-2 text-left transition',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--mw-page)]',
                                    isProjected ? 'opacity-55' : '',
                                    isActive ? 'ring-2 ring-[color:var(--mw-focus)] ring-offset-1 ring-offset-[color:var(--mw-page)]' : '',
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
                                  <span className="truncate text-[10px] font-medium leading-none text-white/92">{barLabel}</span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="absolute inset-0 flex items-center px-2 text-[10px] text-[color:var(--mw-text-muted)]">No projection available</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[color:var(--mw-text-muted)]">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Hover over a session to see details.</span>
                  </div>
                  <p className="whitespace-nowrap text-[10px] font-medium leading-none text-[color:#f25f63]">
                    {currentTimeLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="min-w-0 pt-0.5">
            <ul className="divide-y divide-[rgba(147,166,197,0.08)]">
              {renderedRows.map(({ row }) => (
                <li key={row.market.id} className="grid h-[34px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: getMarketAccentColor(row.market.id) }} />
                    <p className="truncate text-[11px] leading-4 text-[color:var(--mw-text)]">
                      {CITY_LABELS[row.market.id] ?? row.market.exchangeCode} ({row.market.exchangeCode})
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-right text-[11px] leading-4 text-[color:var(--mw-text-secondary)]">
                    {getTimelineSummaryText(row)}
                  </p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </Card>
  );
}
