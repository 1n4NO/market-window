# Market Calendars

Market holiday calendars are bundled as versioned JSON files under `src/data/holiday-calendars/`.

## Structure

Each market gets one JSON bundle:

- `src/data/holiday-calendars/nse.json`
- `src/data/holiday-calendars/tse.json`
- `src/data/holiday-calendars/lse.json`
- `src/data/holiday-calendars/nyse.json`
- `src/data/holiday-calendars/hkex.json`
- `src/data/holiday-calendars/xetra.json`

Each bundle uses this shape:

```json
{
  "marketId": "nyse",
  "version": "2026.1",
  "source": "NYSE Holiday Schedule 2026",
  "years": {
    "2026": {
      "version": "2026.1",
      "source": "NYSE Holiday Schedule 2026",
      "holidays": [
        { "date": "2026-07-03", "name": "Independence Day", "observed": true }
      ]
    }
  }
}
```

Rules:

- `marketId` must match a supported market in `src/config/markets.ts`.
- `version` is required at the bundle level and at each supported year.
- `source` must name the calendar source clearly.
- `holidays` is an array of explicit holiday entries.
- Dates must use `YYYY-MM-DD`.
- Holiday entries are not inferred. They must be listed explicitly.

## Supported Years

Phase 3 bundles 2026 calendars only.

That means:

- known holidays in 2026 are returned as confirmed holidays;
- unsupported years return unknown holiday confidence;
- the market-clock engine still falls back to weekday/session calculations when a year is not covered.

## Annual Update Process

To add a new calendar year:

1. Update the relevant `src/data/holiday-calendars/<market>.json` file.
2. Add a new year entry under `years`.
3. Give the new year its own `version` and `source`.
4. Add only explicit holiday dates from the exchange source.
5. Run `npm run validate:holidays`.
6. Run tests and the full build.

## Validation

Run the bundled calendar validator with:

```bash
npm run validate:holidays
```

The validator checks for:

- malformed dates;
- duplicate holiday entries;
- unknown market IDs;
- missing calendar versions.

## Sources

Calendar source names are recorded in the JSON bundles and should stay human-readable:

- `NSE Trading Holidays 2026`
- `JPX Trading Holidays 2026`
- `LSE Market Holidays 2026`
- `NYSE Holiday Schedule 2026`
- `HKEX Holiday Calendar 2026`
- `Xetra Holiday Schedule 2026`

## Limitations

- The bundled calendars only cover years that have been added explicitly.
- Unknown years do not become fake trading days; the clock engine keeps the schedule-based result and marks holiday confidence as unknown.
- No external holiday API is used in this phase.
- The calendar set is intentionally conservative. If a closure is not listed, it is not implied.
