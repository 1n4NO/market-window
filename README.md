# Market Window

Market Window is a Chrome Manifest V3 new-tab extension that shows a global market-hours dashboard with local market clocks, cached quotes, and provider-aware market data.

## What It Does

- Replaces Chrome's new-tab page through `chrome_url_overrides.newtab`
- Shows market open/close states, session transitions, and countdowns
- Loads instantly from local cache and keeps working without an API key
- Supports a user-owned Twelve Data API key stored in `chrome.storage.local`
- Keeps all schedules, holiday calendars, and settings local to the browser
- Includes an optional market-movers module that is disabled by default

## Requirements

- Node.js 20 or newer
- Chrome or Chromium with Manifest V3 support

## Install Dependencies

```bash
npm install
```

## Development

Run the Vite dev server:

```bash
npm run dev
```

## Production Build

Build the extension bundle:

```bash
npm run build
```

## Packaged Release Artifacts

Create the unpacked extension folder and the Chrome Web Store ZIP:

```bash
npm run package
```

This writes:

- `release/unpacked-extension/`
- `release/market-window-extension.zip`

## Load As An Unpacked Extension

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click `Load unpacked`.
5. Select `release/unpacked-extension/`.

## Tests And Checks

Run the local verification suite:

```bash
npm run lint
npm run typecheck
npm run test
```

Validate bundled holiday calendars:

```bash
npm run validate:holidays
```

## Permissions

The extension uses only:

- `storage`
- `https://api.twelvedata.com/*`

No browsing history, active tab, or content-script permissions are requested.

## Data Limitations

- Demo mode works without an API key and is clearly labeled.
- Twelve Data free-tier responses may be delayed or end-of-day.
- Quote freshness depends on the selected provider and the market session.
- Browser-local storage is convenient, but it does not make an API key secret.
- Market-data requests go directly from the browser to the selected provider.
- Optional movers support is only shown when a provider explicitly advertises it and discloses the mover universe.

## Project Structure

The codebase keeps domain logic separate from React components:

- `src/domain/`
- `src/config/`
- `src/services/`
- `src/components/`
- `src/hooks/`

## Adding Another Market

1. Add the market definition in `src/config/markets.ts`.
2. Add provider-symbol mappings in the market definition.
3. Add the market's holiday calendar bundle under `src/data/holiday-calendars/`.
4. Update `MARKET_CALENDARS.md` with the calendar source and supported year.
5. Add tests for market-clock and dashboard behavior.

## Adding Another Data Provider

1. Implement `MarketDataProvider` in `src/services/marketData/`.
2. Normalize the provider response into `MarketQuote`.
3. Register the provider in `src/services/marketData/providerRegistry.ts`.
4. Add validation and cache tests for the provider.
5. Update the settings drawer if the provider needs extra configuration.

## Documentation

- [Architecture](./ARCHITECTURE.md)
- [Data Providers](./DATA_PROVIDERS.md)
- [Market Calendars](./MARKET_CALENDARS.md)
- [Privacy](./PRIVACY.md)
- [Chrome Web Store Assets Checklist](./CHROME_WEB_STORE_ASSETS.md)
- [Changelog](./CHANGELOG.md)

## Chrome Web Store Packaging

Before upload:

1. Run `npm run build`.
2. Run `npm run package`.
3. Verify the icon set, screenshots, and store listing copy.
4. Upload `release/market-window-extension.zip`.
