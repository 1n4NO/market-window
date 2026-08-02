import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const calendarRoot = join(projectRoot, 'src', 'data', 'holiday-calendars');
const supportedMarketIds = new Set(['nse', 'tse', 'lse', 'nyse', 'hkex', 'xetra']);

function isValidCalendarDate(dateText) {
  if (typeof dateText !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return false;
  }
  const parsed = new Date(`${dateText}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateText;
}

async function collectJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(absolute)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(absolute);
    }
  }

  return files;
}

async function main() {
  const files = await collectJsonFiles(calendarRoot);
  const errors = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      errors.push(`${relative(projectRoot, file)}: invalid JSON`);
      continue;
    }

    const label = relative(projectRoot, file);
    if (!supportedMarketIds.has(parsed.marketId)) {
      errors.push(`${label}: unknown market id "${parsed.marketId ?? ''}"`);
      continue;
    }
    if (typeof parsed.version !== 'string' || !parsed.version.trim()) {
      errors.push(`${label}: missing calendar version`);
    }
    if (!parsed.years || typeof parsed.years !== 'object') {
      errors.push(`${label}: missing years object`);
      continue;
    }

    for (const [year, yearCalendar] of Object.entries(parsed.years)) {
      if (typeof yearCalendar.version !== 'string' || !yearCalendar.version.trim()) {
        errors.push(`${label}: missing calendar version for year ${year}`);
      }
      if (!Array.isArray(yearCalendar.holidays)) {
        errors.push(`${label}: year ${year} holidays must be an array`);
        continue;
      }

      const seenDates = new Set();
      for (const holiday of yearCalendar.holidays) {
        if (!isValidCalendarDate(holiday.date)) {
          errors.push(`${label}: malformed holiday date "${holiday.date}" in year ${year}`);
        }
        if (seenDates.has(holiday.date)) {
          errors.push(`${label}: duplicate holiday entry for ${holiday.date} in year ${year}`);
        }
        seenDates.add(holiday.date);

        if (holiday.marketId && holiday.marketId !== parsed.marketId) {
          errors.push(`${label}: holiday marketId "${holiday.marketId}" does not match bundle marketId "${parsed.marketId}"`);
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${files.length} holiday calendar files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
