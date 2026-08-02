import hkex from './hkex.json';
import lse from './lse.json';
import nse from './nse.json';
import nyse from './nyse.json';
import tse from './tse.json';
import xetra from './xetra.json';
import type { HolidayCalendarMap } from '../../services/holidayProvider/holidayProvider';

export const HOLIDAY_CALENDARS: HolidayCalendarMap = {
  nse,
  tse,
  lse,
  nyse,
  hkex,
  xetra,
};
