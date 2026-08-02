# Market Window

Market Window is a Chrome Manifest V3 new-tab extension that shows a calm, premium global stock-market hours dashboard.

It is designed to answer, at a glance:

- which major markets are open now
- which are closed, on break, or opening soon
- when each market next opens or closes
- the latest available value for each market's primary index
- the latest completed-session move for that index
- which market opens next

## Current Status

This repository is being built in phases. The initial implementation will focus on:

- the extension scaffold and manifest
- the market-clock and holiday logic
- normalized market data providers
- local caching and refresh behavior
- the new-tab dashboard UI
- settings, shortcuts, and tests

## Goals

- Replace Chrome's default new-tab page with `newtab.html`
- Keep the dashboard fast by rendering cached data immediately
- Work without an API key using clearly labeled demo data
- Support a user-supplied Twelve Data API key stored locally in `chrome.storage.local`
- Avoid browsing-history permissions and avoid any backend server

## Planned Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Chrome Extension Manifest V3
- `chrome.storage.local`
- `date-fns`
- `date-fns-tz`
- Vitest
- React Testing Library
- ESLint
- Prettier
- Lucide React

## Supported Markets

The first version is planned to support:

- NSE, India: NIFTY 50
- Tokyo Stock Exchange, Japan: Nikkei 225
- London Stock Exchange, United Kingdom: FTSE 100
- NYSE, United States: S&P 500
- HKEX, Hong Kong: Hang Seng
- Xetra, Germany: DAX

## UI Reference

The design direction is based on the supplied `UI-reference.png`, which presents a dark, premium, data-dense dashboard with:

- a strong hierarchy in the header
- a horizontal market-hours timeline
- compact market cards
- upcoming transitions
- summary and quick-link panels

## Repository Layout

The target structure will follow this general shape:

```text
src/
  app/
  components/
  config/
  domain/
  services/
  hooks/
  utils/
  styles/
  test/
public/
  icons/
manifest.json
```

## Phase Plan

1. Scaffold the extension and build pipeline.
2. Implement market clocks, holiday calendars, and quote normalization.
3. Build the dashboard, timeline, settings drawer, and quick links.
4. Add caching, demo mode, and provider integration.
5. Add tests, polish accessibility, and verify packaging.

## Documentation

Planned supporting docs:

- `ARCHITECTURE.md`
- `DATA_PROVIDERS.md`
- `MARKET_CALENDARS.md`
- `PRIVACY.md`

## Notes

- No live market data is shipped in source control.
- Demo mode must remain usable without an API key.
- The extension will not modify normal websites.
- The extension will not collect browsing history.
