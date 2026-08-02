# Architecture

Market Window is split into a small set of focused layers so market rules, persistence, and UI rendering stay independently testable.

## Layer Overview

### `src/domain/`

Pure type and validation definitions:

- market definitions
- sessions
- quotes
- user settings
- quick links
- holiday metadata

### `src/config/`

Static configuration for supported markets and provider-symbol mappings.

### `src/services/`

Domain services and side-effect adapters:

- `marketClock/` calculates market state from timezones, sessions, and holiday data
- `holidayProvider/` serves bundled calendar data
- `marketData/` normalizes provider responses and manages quote caching
- `marketMovers/` is an optional, isolated mover cache and view-model layer that stays disabled unless the feature flag is turned on
- `storage/` wraps `chrome.storage.local`
- `marketDashboard/` derives dashboard card, summary, and transition models
- `marketTimeline/` projects sessions into the viewer's local timezone

### `src/components/`

React UI components, split into:

- layout primitives
- dashboard panels
- market cards
- timeline
- settings
- feedback states

### `src/hooks/`

Hooks bridge React to the storage controller, market clocks, countdown text, and online status.

## Data Flow

1. `chrome.storage.local` is hydrated into a typed settings and quote-cache snapshot.
2. `useMarketClockStates` calculates market state locally.
3. The dashboard model combines market metadata, cached quotes, and clock state.
4. React renders cards, panels, and the timeline from normalized models only.
5. Quote refreshes happen through provider adapters and write back to storage after successful normalization.

## Resilience Strategy

- Error boundaries isolate sections of the new-tab page so one panel failure does not take down the whole dashboard.
- Offline mode keeps the local market clock active and preserves cached quotes.
- Quote refreshes are deduplicated and throttled with persisted retry guards to avoid request bursts.
- Invalid storage payloads are normalized or discarded instead of crashing the UI.

## Release Artifacts

Production build output is copied into:

- `release/unpacked-extension/`
- `release/market-window-extension.zip`

The ZIP is the upload artifact for Chrome Web Store packaging.

## Constraints

- No backend server
- No remotely hosted JavaScript
- No browsing-history, active-tab, or content-script permissions
- No analytics or authentication in version one
