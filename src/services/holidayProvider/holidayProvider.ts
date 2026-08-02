import { isValid as isValidDate, parseISO } from 'date-fns';

export interface HolidayProvider {
  isHoliday(marketId: string, date: Date): Promise<boolean>;
  getCalendarVersion(marketId: string): string | null;
}

export type HolidayConfidence = 'confirmed' | 'unknown';

export interface HolidayEntry {
  date: string;
  name: string;
  observed?: boolean;
}

export interface HolidayYearCalendar {
  version: string;
  source: string;
  holidays: HolidayEntry[];
}

export interface HolidayMarketCalendar {
  marketId: string;
  version: string;
  source: string;
  years: Record<string, HolidayYearCalendar>;
}

export interface HolidayCalendarMap {
  [marketId: string]: HolidayMarketCalendar;
}

export interface HolidayLookupResult {
  marketId: string;
  calendarVersion: string | null;
  confidence: HolidayConfidence;
  isHoliday: boolean;
  supportedYear: boolean;
  source: string | null;
  holiday: HolidayEntry | null;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isValidHolidayDate(dateText: string): boolean {
  const parsed = parseISO(dateText);
  return isValidDate(parsed) && toIsoDate(parsed) === dateText;
}

function getYear(date: Date): string {
  return String(date.getUTCFullYear());
}

export function isValidHolidayEntry(entry: HolidayEntry): boolean {
  return typeof entry.name === 'string' && entry.name.trim().length > 0 && isValidHolidayDate(entry.date);
}

export class BundledHolidayProvider implements HolidayProvider {
  constructor(private readonly calendars: HolidayCalendarMap) {}

  getCalendarVersion(marketId: string): string | null {
    return this.calendars[marketId]?.version ?? null;
  }

  async isHoliday(marketId: string, date: Date): Promise<boolean> {
    return this.evaluateHoliday(marketId, date).isHoliday;
  }

  evaluateHoliday(marketId: string, date: Date): HolidayLookupResult {
    const calendar = this.calendars[marketId];
    if (!calendar || !isValidDate(date)) {
      return {
        marketId,
        calendarVersion: null,
        confidence: 'unknown',
        isHoliday: false,
        supportedYear: false,
        source: null,
        holiday: null,
      };
    }

    const year = getYear(date);
    const yearCalendar = calendar.years[year];
    if (!yearCalendar) {
      return {
        marketId,
        calendarVersion: calendar.version,
        confidence: 'unknown',
        isHoliday: false,
        supportedYear: false,
        source: null,
        holiday: null,
      };
    }

    const holiday = yearCalendar.holidays.find((entry) => entry.date === toIsoDate(date)) ?? null;
    return {
      marketId,
      calendarVersion: yearCalendar.version || calendar.version,
      confidence: 'confirmed',
      isHoliday: holiday !== null,
      supportedYear: true,
      source: yearCalendar.source,
      holiday,
    };
  }
}

export function createBundledHolidayProvider(calendars: HolidayCalendarMap): BundledHolidayProvider {
  return new BundledHolidayProvider(calendars);
}
