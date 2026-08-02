import { compareAsc } from 'date-fns';
import { formatInTimeZone, getTimezoneOffset, toZonedTime } from 'date-fns-tz';
import type { MarketClockState, MarketDefinition, MarketState, SessionDefinition, Weekday } from '../../domain/market';
import { WEEKDAYS } from '../../domain/market';

interface DateParts {
  year: number;
  monthIndex: number;
  day: number;
}

interface LocalTimeParts {
  hour: number;
  minute: number;
}

interface SessionWindow {
  market: MarketDefinition;
  session: SessionDefinition;
  openAt: Date;
  closeAt: Date;
  localDateKey: string;
}

export interface TimelineHourMarker {
  hour: number;
  label: string;
  leftPercent: number;
}

export interface TimelineSessionProjection {
  id: string;
  marketId: string;
  exchangeCode: string;
  country: string;
  indexName: string;
  iconId: string;
  colorToken: string;
  marketState: MarketState;
  nextTransitionAt: string | null;
  nextAction: string | null;
  sessionId: string;
  sessionLabel: string;
  startAt: string;
  endAt: string;
  startMinute: number;
  endMinute: number;
  startPercent: number;
  endPercent: number;
  widthPercent: number;
  continuesBeforeDay: boolean;
  continuesAfterDay: boolean;
  localStartLabel: string;
  localEndLabel: string;
}

export interface TimelineMarketRow {
  market: MarketDefinition;
  clockState: MarketClockState;
  segments: TimelineSessionProjection[];
}

export interface MarketHoursTimelineModel {
  viewerTimeZone: string;
  dayStartAt: string;
  currentMinute: number;
  currentMarkerLeftPercent: number;
  hourMarkers: TimelineHourMarker[];
  rows: TimelineMarketRow[];
  statusCounts: Record<MarketState, number>;
  srSummary: string;
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function getLocalDateParts(instant: Date, timeZone: string): DateParts {
  const zoned = toZonedTime(instant, timeZone);
  return {
    year: zoned.getFullYear(),
    monthIndex: zoned.getMonth(),
    day: zoned.getDate(),
  };
}

function shiftLocalDateParts(parts: DateParts, offsetDays: number): DateParts {
  const shifted = new Date(Date.UTC(parts.year, parts.monthIndex, parts.day + offsetDays));
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function formatLocalDateKey(parts: DateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.monthIndex + 1).padStart(2, '0')}-${String(
    parts.day,
  ).padStart(2, '0')}`;
}

function parseTimeParts(time: string): LocalTimeParts {
  const [hourText, minuteText] = time.split(':');
  return {
    hour: Number(hourText),
    minute: Number(minuteText),
  };
}

function localDateTimeToUtc(timeZone: string, dateParts: DateParts, timeParts: LocalTimeParts): Date {
  const localEpoch = Date.UTC(dateParts.year, dateParts.monthIndex, dateParts.day, timeParts.hour, timeParts.minute, 0, 0);
  let candidate = new Date(localEpoch);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const offset = getTimezoneOffset(timeZone, candidate);
    if (Number.isNaN(offset)) {
      return new Date(NaN);
    }
    const nextCandidate = new Date(localEpoch - offset);
    if (nextCandidate.getTime() === candidate.getTime()) {
      return nextCandidate;
    }
    candidate = nextCandidate;
  }

  return candidate;
}

function getLocalWeekdayFromParts(parts: DateParts): Weekday {
  const jsWeekday = new Date(Date.UTC(parts.year, parts.monthIndex, parts.day)).getUTCDay();
  return WEEKDAYS[(jsWeekday + 6) % 7] ?? 'monday';
}

function getMinutesSinceLocalMidnight(instant: Date, timeZone: string): number {
  const zoned = toZonedTime(instant, timeZone);
  return (
    zoned.getHours() * 60 +
    zoned.getMinutes() +
    zoned.getSeconds() / 60 +
    zoned.getMilliseconds() / 60000
  );
}

function getDayBounds(instant: Date, viewerTimeZone: string): { dayStartAt: Date; nextDayStartAt: Date; viewerDateParts: DateParts } {
  const viewerDateParts = getLocalDateParts(instant, viewerTimeZone);
  const dayStartAt = localDateTimeToUtc(viewerTimeZone, viewerDateParts, { hour: 0, minute: 0 });
  const nextDayStartAt = localDateTimeToUtc(viewerTimeZone, shiftLocalDateParts(viewerDateParts, 1), { hour: 0, minute: 0 });
  return { dayStartAt, nextDayStartAt, viewerDateParts };
}

function isWeekdayEnabled(session: SessionDefinition, day: Weekday): boolean {
  return session.weekdays.includes(day);
}

function getSessionWindow(
  market: MarketDefinition,
  session: SessionDefinition,
  candidateParts: DateParts,
): SessionWindow | null {
  const localDay = getLocalWeekdayFromParts(candidateParts);
  if (!isWeekdayEnabled(session, localDay)) {
    return null;
  }

  const openTime = parseTimeParts(session.openTime);
  const closeTime = parseTimeParts(session.closeTime);
  const openAt = localDateTimeToUtc(market.timezone, candidateParts, openTime);
  const closeDateParts =
    closeTime.hour > openTime.hour || (closeTime.hour === openTime.hour && closeTime.minute > openTime.minute)
      ? candidateParts
      : closeTime.hour === openTime.hour && closeTime.minute === openTime.minute
        ? null
        : shiftLocalDateParts(candidateParts, 1);

  if (!isValidDate(openAt) || closeDateParts === null) {
    return null;
  }

  const closeAt = localDateTimeToUtc(market.timezone, closeDateParts, closeTime);
  if (!isValidDate(closeAt)) {
    return null;
  }

  return {
    market,
    session,
    openAt,
    closeAt,
    localDateKey: formatLocalDateKey(candidateParts),
  };
}

function buildSessionWindows(market: MarketDefinition, viewerInstant: Date): SessionWindow[] {
  const viewerParts = getLocalDateParts(viewerInstant, market.timezone);
  const windows: SessionWindow[] = [];

  for (let offset = -2; offset <= 2; offset += 1) {
    const candidateParts = shiftLocalDateParts(viewerParts, offset);
    for (const session of market.sessions) {
      const window = getSessionWindow(market, session, candidateParts);
      if (window) {
        windows.push(window);
      }
    }
  }

  windows.sort((left, right) => compareAsc(left.openAt, right.openAt));
  return windows;
}

function projectSessionToViewerDay(
  window: SessionWindow,
  viewerTimeZone: string,
  dayStartAt: Date,
  nextDayStartAt: Date,
): TimelineSessionProjection | null {
  if (window.closeAt.getTime() <= dayStartAt.getTime() || window.openAt.getTime() >= nextDayStartAt.getTime()) {
    return null;
  }

  const clippedStart = window.openAt.getTime() < dayStartAt.getTime() ? dayStartAt : window.openAt;
  const clippedEnd = window.closeAt.getTime() > nextDayStartAt.getTime() ? nextDayStartAt : window.closeAt;
  const startMinute = getMinutesSinceLocalMidnight(clippedStart, viewerTimeZone);
  const endMinute = clippedEnd.getTime() === nextDayStartAt.getTime() ? 1440 : getMinutesSinceLocalMidnight(clippedEnd, viewerTimeZone);
  const widthPercent = Math.max(0.15, ((endMinute - startMinute) / 1440) * 100);

  return {
    id: `${window.market.id}:${window.session.id}:${window.localDateKey}`,
    marketId: window.market.id,
    exchangeCode: window.market.exchangeCode,
    country: window.market.country,
    indexName: window.market.indexName,
    iconId: window.market.iconId,
    colorToken: window.market.colorToken,
    marketState: 'unknown',
    nextTransitionAt: null,
    nextAction: null,
    sessionId: window.session.id,
    sessionLabel: window.session.label,
    startAt: clippedStart.toISOString(),
    endAt: clippedEnd.toISOString(),
    startMinute,
    endMinute,
    startPercent: (startMinute / 1440) * 100,
    endPercent: (endMinute / 1440) * 100,
    widthPercent,
    continuesBeforeDay: window.openAt.getTime() < dayStartAt.getTime(),
    continuesAfterDay: window.closeAt.getTime() > nextDayStartAt.getTime(),
    localStartLabel: formatInTimeZone(clippedStart, viewerTimeZone, 'HH:mm'),
    localEndLabel: formatInTimeZone(clippedEnd, viewerTimeZone, 'HH:mm'),
  };
}

function toStateText(state: MarketState): string {
  return state.replace('-', ' ');
}

function describeTransition(clockState: MarketClockState): string {
  if (clockState.nextAction) {
    return clockState.nextAction;
  }
  if (clockState.nextTransitionAt) {
    return `Next transition at ${clockState.nextTransitionAt}`;
  }
  return 'No upcoming transition';
}

function countStates(rows: TimelineMarketRow[]): Record<MarketState, number> {
  const counts: Record<MarketState, number> = {
    open: 0,
    closed: 0,
    'pre-market': 0,
    'lunch-break': 0,
    weekend: 0,
    holiday: 0,
    unknown: 0,
  };

  for (const row of rows) {
    counts[row.clockState.state] += 1;
  }

  return counts;
}

export function buildMarketHoursTimelineModel({
  markets,
  marketStates,
  instant,
  viewerTimeZone,
}: {
  markets: MarketDefinition[];
  marketStates: Record<string, MarketClockState>;
  instant: Date;
  viewerTimeZone: string;
}): MarketHoursTimelineModel {
  const { dayStartAt, nextDayStartAt } = getDayBounds(instant, viewerTimeZone);
  const currentMinute = getMinutesSinceLocalMidnight(instant, viewerTimeZone);
  const hourMarkers: TimelineHourMarker[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    leftPercent: (hour / 24) * 100,
  }));

  const rows: TimelineMarketRow[] = markets.map((market) => {
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

    const segments = buildSessionWindows(market, instant)
      .map((window) => projectSessionToViewerDay(window, viewerTimeZone, dayStartAt, nextDayStartAt))
      .filter((segment): segment is TimelineSessionProjection => segment !== null)
      .map((segment) => ({
        ...segment,
        marketState: clockState.state,
        nextTransitionAt: clockState.nextTransitionAt,
        nextAction: clockState.nextAction,
      }));

    return {
      market,
      clockState,
      segments,
    };
  });

  const statusCounts = countStates(rows);
  const currentMarkerLeftPercent = Math.max(0, Math.min(100, (currentMinute / 1440) * 100));
  const srSummary = [
    `${rows.length} enabled markets`,
    `${statusCounts.open} open`,
    `${statusCounts.closed} closed`,
    `${statusCounts['lunch-break']} on lunch break`,
    `${statusCounts['pre-market']} pre-market`,
    `${statusCounts.weekend} on weekend`,
    `${statusCounts.holiday} on holiday`,
    `${statusCounts.unknown} unknown`,
    'Timeline is ordered by viewer local time.',
  ].join('. ');

  return {
    viewerTimeZone,
    dayStartAt: dayStartAt.toISOString(),
    currentMinute,
    currentMarkerLeftPercent,
    hourMarkers,
    rows,
    statusCounts,
    srSummary,
  };
}

export function getTimelineMarketLabel(market: MarketDefinition): string {
  return `${market.exchangeCode} ${market.indexName}`;
}

export function getTimelineStatusText(clockState: MarketClockState): string {
  const state = toStateText(clockState.state);
  const transition = describeTransition(clockState);
  return `${state}. ${transition}.`;
}

export function getTimelineSegmentAriaLabel(segment: TimelineSessionProjection): string {
  const continuationPrefix = segment.continuesBeforeDay ? 'Continues from the previous day. ' : '';
  const continuationSuffix = segment.continuesAfterDay ? ' Continues into the next day.' : '';
  return `${segment.exchangeCode}, ${segment.sessionLabel}, ${segment.localStartLabel} to ${segment.localEndLabel}. ${segment.marketState}. ${describeTransition({
    state: segment.marketState,
    nextTransitionAt: segment.nextTransitionAt,
    previousTransitionAt: null,
    millisecondsUntilTransition: null,
    activeSession: null,
    nextSession: null,
    nextAction: segment.nextAction,
    holidayConfidence: 'unknown',
  })}.${continuationPrefix}${continuationSuffix}`;
}
