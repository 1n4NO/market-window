import { describe, expect, it } from 'vitest';
import { HOLIDAY_CALENDARS } from '../../data/holiday-calendars';
import { BundledHolidayProvider } from './holidayProvider';

const provider = new BundledHolidayProvider(HOLIDAY_CALENDARS);

describe('BundledHolidayProvider', () => {
  it('returns a known holiday', () => {
    const result = provider.evaluateHoliday('nse', new Date('2026-01-26T06:00:00.000Z'));

    expect(result.confidence).toBe('confirmed');
    expect(result.isHoliday).toBe(true);
    expect(result.holiday?.name).toBe('Republic Day');
  });

  it('returns an observed holiday', () => {
    const result = provider.evaluateHoliday('nyse', new Date('2026-07-03T12:00:00.000Z'));

    expect(result.confidence).toBe('confirmed');
    expect(result.isHoliday).toBe(true);
    expect(result.holiday?.observed).toBe(true);
    expect(result.holiday?.name).toBe('Independence Day');
  });

  it('returns a normal weekday as a non-holiday', () => {
    const result = provider.evaluateHoliday('nse', new Date('2026-08-03T06:00:00.000Z'));

    expect(result.confidence).toBe('confirmed');
    expect(result.isHoliday).toBe(false);
    expect(result.holiday).toBeNull();
  });

  it('returns a weekend as a non-holiday', () => {
    const result = provider.evaluateHoliday('nse', new Date('2026-08-02T06:00:00.000Z'));

    expect(result.confidence).toBe('confirmed');
    expect(result.isHoliday).toBe(false);
    expect(result.holiday).toBeNull();
  });

  it('returns unknown confidence for an unsupported year', () => {
    const result = provider.evaluateHoliday('nse', new Date('2027-01-26T06:00:00.000Z'));

    expect(result.confidence).toBe('unknown');
    expect(result.supportedYear).toBe(false);
    expect(result.isHoliday).toBe(false);
    expect(result.holiday).toBeNull();
  });

  it('exposes calendar versions per market', () => {
    expect(provider.getCalendarVersion('nse')).toBe('2026.1');
    expect(provider.getCalendarVersion('missing')).toBeNull();
  });
});
