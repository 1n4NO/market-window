import { compareAsc, differenceInMilliseconds, intervalToDuration } from 'date-fns';
import { formatInTimeZone, getTimezoneOffset, toZonedTime } from 'date-fns-tz';
import type {
  MarketClockState,
  MarketDefinition,
  MarketState,
  SessionDefinition,
  Weekday,
} from '../../domain/market';
import { WEEKDAYS } from '../../domain/market';

export interface HolidayProvider {
  isHoliday(marketId: string, date: Date): Promise<boolean>;
}

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
  session: SessionDefinition;
  openAt: Date;
  closeAt: Date;
  localDateKey: string;
}

interface TransitionPoint {
  at: Date;
  kind: 'open' | 'close';
  session: SessionDefinition;
  localDateKey: string;
}

const SEARCH_DAYS_BEFORE = 10;
const SEARCH_DAYS_AFTER = 14;

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

function getLocalDayOfWeek(instant: Date, timeZone: string): Weekday {
  const zoned = toZonedTime(instant, timeZone);
  return WEEKDAYS[(zoned.getDay() + 6) % 7] ?? 'monday';
}

function getLocalWeekdayFromParts(parts: DateParts): Weekday {
  const jsWeekday = new Date(Date.UTC(parts.year, parts.monthIndex, parts.day)).getUTCDay();
  return WEEKDAYS[(jsWeekday + 6) % 7] ?? 'monday';
}

function formatLocalDateKey(parts: DateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.monthIndex + 1).padStart(2, '0')}-${String(
    parts.day,
  ).padStart(2, '0')}`;
}

function shiftLocalDateParts(parts: DateParts, offsetDays: number): DateParts {
  const shifted = new Date(Date.UTC(parts.year, parts.monthIndex, parts.day + offsetDays));
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
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

function isSessionEnabledForDate(session: SessionDefinition, day: Weekday): boolean {
  return session.weekdays.includes(day);
}

function getSessionWindowForDate(
  market: MarketDefinition,
  session: SessionDefinition,
  dateParts: DateParts,
): SessionWindow | null {
  const localDay = getLocalWeekdayFromParts(dateParts);
  if (!isSessionEnabledForDate(session, localDay)) {
    return null;
  }

  const openTime = parseTimeParts(session.openTime);
  const closeTime = parseTimeParts(session.closeTime);
  const openAt = localDateTimeToUtc(market.timezone, dateParts, openTime);
  const closeDateParts = closeTime.hour > openTime.hour || (closeTime.hour === openTime.hour && closeTime.minute > openTime.minute)
    ? dateParts
    : closeTime.hour === openTime.hour && closeTime.minute === openTime.minute
      ? null
      : shiftLocalDateParts(dateParts, 1);

  if (!isValidDate(openAt) || closeDateParts === null) {
    return null;
  }

  const closeAt = localDateTimeToUtc(market.timezone, closeDateParts, closeTime);
  if (!isValidDate(closeAt)) {
    return null;
  }

  return {
    session,
    openAt,
    closeAt,
    localDateKey: formatLocalDateKey(dateParts),
  };
}

async function buildSessionWindows(
  market: MarketDefinition,
  instant: Date,
  holidayProvider?: HolidayProvider,
): Promise<SessionWindow[]> {
  const localParts = getLocalDateParts(instant, market.timezone);
  const windows: SessionWindow[] = [];

  for (let offset = -SEARCH_DAYS_BEFORE; offset <= SEARCH_DAYS_AFTER; offset += 1) {
    const candidateParts = shiftLocalDateParts(localParts, offset);
    if (await isHolidayForDate(market, holidayProvider, candidateParts)) {
      continue;
    }
    for (const session of market.sessions) {
      const window = getSessionWindowForDate(market, session, candidateParts);
      if (window) {
        windows.push(window);
      }
    }
  }

  windows.sort((a, b) => compareAsc(a.openAt, b.openAt));
  return windows;
}

function buildTransitionPoints(windows: SessionWindow[]): TransitionPoint[] {
  const transitions: TransitionPoint[] = [];

  for (const window of windows) {
    transitions.push({
      at: window.openAt,
      kind: 'open',
      session: window.session,
      localDateKey: window.localDateKey,
    });
    transitions.push({
      at: window.closeAt,
      kind: 'close',
      session: window.session,
      localDateKey: window.localDateKey,
    });
  }

  transitions.sort((a, b) => compareAsc(a.at, b.at));
  return transitions;
}

function findActiveWindow(windows: SessionWindow[], instant: Date): SessionWindow | null {
  return (
    windows.find((window) => window.openAt.getTime() <= instant.getTime() && instant.getTime() < window.closeAt.getTime()) ??
    null
  );
}

function findOpenWindowsForDate(windows: SessionWindow[], localDateKey: string): SessionWindow[] {
  return windows.filter((window) => window.localDateKey === localDateKey).sort((a, b) => compareAsc(a.openAt, b.openAt));
}

function getStateFromSchedule(
  market: MarketDefinition,
  instant: Date,
  windows: SessionWindow[],
  currentDateKey: string,
  holidayToday: boolean,
): {
  state: MarketState;
  activeSession: SessionDefinition | null;
} {
  const activeWindow = findActiveWindow(windows, instant);
  if (activeWindow) {
    return {
      state: 'open',
      activeSession: activeWindow.session,
    };
  }

  if (holidayToday) {
    return {
      state: 'holiday',
      activeSession: null,
    };
  }

  const localDay = getLocalDayOfWeek(instant, market.timezone);
  const todayWindows = findOpenWindowsForDate(windows, currentDateKey);
  const futureTodayWindows = todayWindows.filter((window) => window.openAt.getTime() > instant.getTime());
  const pastTodayWindows = todayWindows.filter((window) => window.closeAt.getTime() <= instant.getTime());

  if (localDay === 'saturday' || localDay === 'sunday') {
    return {
      state: 'weekend',
      activeSession: null,
    };
  }

  if (futureTodayWindows.length > 0 && pastTodayWindows.length === 0) {
    return {
      state: 'pre-market',
      activeSession: null,
    };
  }

  if (futureTodayWindows.length > 0 && pastTodayWindows.length > 0) {
    return {
      state: 'lunch-break',
      activeSession: null,
    };
  }

  if (pastTodayWindows.length > 0 && futureTodayWindows.length === 0) {
    return {
      state: 'closed',
      activeSession: null,
    };
  }

  if (todayWindows.length > 0 && instant.getTime() < todayWindows[0].openAt.getTime()) {
    return {
      state: 'pre-market',
      activeSession: null,
    };
  }

  return {
    state: 'unknown',
    activeSession: null,
  };
}

function getTransitionMetadata(
  instant: Date,
  transitions: TransitionPoint[],
): {
  previousTransitionAt: string | null;
  nextTransitionAt: string | null;
  millisecondsUntilTransition: number | null;
  nextTransition: TransitionPoint | null;
  previousTransition: TransitionPoint | null;
} {
  let previousTransition: TransitionPoint | null = null;
  let nextTransition: TransitionPoint | null = null;

  for (const transition of transitions) {
    if (transition.at.getTime() <= instant.getTime()) {
      if (!previousTransition || compareAsc(previousTransition.at, transition.at) <= 0) {
        previousTransition = transition;
      }
      continue;
    }

    if (!nextTransition || compareAsc(transition.at, nextTransition.at) < 0) {
      nextTransition = transition;
    }
  }

  return {
    previousTransitionAt: previousTransition ? previousTransition.at.toISOString() : null,
    nextTransitionAt: nextTransition ? nextTransition.at.toISOString() : null,
    millisecondsUntilTransition: nextTransition ? differenceInMilliseconds(nextTransition.at, instant) : null,
    nextTransition,
    previousTransition,
  };
}

function formatDurationParts(milliseconds: number): string {
  const safeMilliseconds = Math.max(0, milliseconds);
  const duration = intervalToDuration({ start: 0, end: safeMilliseconds });
  const parts: string[] = [];

  if (duration.days) {
    parts.push(`${duration.days}d`);
  }
  if (duration.hours) {
    parts.push(`${duration.hours}h`);
  }
  if (duration.minutes || parts.length === 0) {
    parts.push(`${duration.minutes ?? 0}m`);
  }

  return parts.join(' ');
}

function getHumanReadableNextAction(
  market: MarketDefinition,
  state: MarketState,
  nextTransitionAt: string | null,
  millisecondsUntilTransition: number | null,
  nextSession: SessionDefinition | null,
  instant: Date,
  currentDateKey: string,
): string | null {
  if (!nextTransitionAt || millisecondsUntilTransition === null) {
    return null;
  }

  const duration = formatDurationParts(millisecondsUntilTransition);
  const nextTransition = new Date(nextTransitionAt);
  const nextDateKey = formatInTimeZone(nextTransition, market.timezone, 'yyyy-MM-dd');
  const tomorrowKey = formatLocalDateKey(shiftLocalDateParts(getLocalDateParts(instant, market.timezone), 1));

  if (state === 'open') {
    return `Closes in ${duration}`;
  }

  if (state === 'lunch-break') {
    return `Reopens in ${duration}`;
  }

  if (nextSession) {
    const timeLabel = formatInTimeZone(nextTransition, market.timezone, 'HH:mm');
    if (nextDateKey === tomorrowKey) {
      return `Opens tomorrow at ${timeLabel}`;
    }
    if (nextDateKey !== currentDateKey) {
      return `Opens on ${formatInTimeZone(nextTransition, market.timezone, 'EEEE')} at ${timeLabel}`;
    }
  }

  if (state === 'weekend' || state === 'holiday' || state === 'closed' || state === 'pre-market') {
    return `Opens in ${duration}`;
  }

  return null;
}

async function isHolidayForDate(
  market: MarketDefinition,
  holidayProvider: HolidayProvider | undefined,
  dateParts: DateParts,
): Promise<boolean> {
  if (!holidayProvider) {
    return false;
  }

  const middayUtc = localDateTimeToUtc(market.timezone, dateParts, { hour: 12, minute: 0 });
  if (!isValidDate(middayUtc)) {
    return false;
  }

  try {
    return await holidayProvider.isHoliday(market.id, middayUtc);
  } catch {
    return false;
  }
}

export async function getMarketClockState(
  market: MarketDefinition,
  instant: Date,
  holidayProvider?: HolidayProvider,
): Promise<MarketClockState> {
  if (!isValidDate(instant) || !market.sessions.length) {
    return {
      state: 'unknown',
      nextTransitionAt: null,
      previousTransitionAt: null,
      millisecondsUntilTransition: null,
      activeSession: null,
      nextSession: null,
      nextAction: null,
    };
  }

  const windows = await buildSessionWindows(market, instant, holidayProvider);
  const transitions = buildTransitionPoints(windows);
  const localParts = getLocalDateParts(instant, market.timezone);
  const currentDateKey = formatLocalDateKey(localParts);
  const holidayToday = await isHolidayForDate(market, holidayProvider, localParts);
  const scheduleState = getStateFromSchedule(market, instant, windows, currentDateKey, holidayToday);
  const nextWindow = windows.find((window) => window.openAt.getTime() > instant.getTime()) ?? null;
  const transitionMetadata = getTransitionMetadata(instant, transitions);

  const nextAction = getHumanReadableNextAction(
    market,
    scheduleState.state,
    transitionMetadata.nextTransitionAt,
    transitionMetadata.millisecondsUntilTransition,
    nextWindow?.session ?? null,
    instant,
    currentDateKey,
  );

  if (scheduleState.state === 'unknown' && transitionMetadata.nextTransitionAt === null) {
    return {
      state: 'unknown',
      nextTransitionAt: null,
      previousTransitionAt: transitionMetadata.previousTransitionAt,
      millisecondsUntilTransition: null,
      activeSession: null,
      nextSession: nextWindow?.session ?? null,
      nextAction: null,
    };
  }

  return {
    state: scheduleState.state,
    nextTransitionAt: transitionMetadata.nextTransitionAt,
    previousTransitionAt: transitionMetadata.previousTransitionAt,
    millisecondsUntilTransition: transitionMetadata.millisecondsUntilTransition,
    activeSession: scheduleState.activeSession,
    nextSession: nextWindow?.session ?? null,
    nextAction,
  };
}
