# Data Providers

This extension uses a provider-neutral market-data layer so the UI only ever sees normalized `MarketQuote` objects.

## How the adapter works

- A provider implements `MarketDataProvider`.
- The extension asks the provider to validate an API key and fetch quotes for a `MarketDefinition`.
- Provider responses are normalized into the shared `MarketQuote` shape before they reach React.
- The cache layer stores the normalized quote, the fetch timestamp, the provider timestamp, the expiry timestamp, and the provider id.
- If the configured provider is unavailable or no API key exists, the app falls back to the bundled mock provider so demo mode still works.

## Current providers

- `mock`
- `twelvedata`

## Known free-tier limitations

- Twelve Data free plans may return delayed data or limited symbol coverage.
- Rate limits can be hit if many markets refresh at once.
- Some symbols can be unavailable on lower plans or for specific exchanges.
- Quote availability and latency depend on the selected plan and the provider’s current API behavior.

## API-key exposure

- This is a client-only browser extension.
- The user’s API key is stored in `chrome.storage.local`.
- That storage is convenient for persistence, but it does not make the key secret from someone who can inspect the browser profile or extension state.
- Requests go directly from the browser to the provider.

## Adding another provider

1. Implement `MarketDataProvider`.
2. Add provider-specific normalization so the React layer still receives `MarketQuote`.
3. Register the provider in `src/services/marketData/providerRegistry.ts`.
4. Add provider-specific validation and cache tests.
5. Update the settings UI if the provider needs additional configuration.

## Symbol overrides

- Market definitions carry the default provider symbols.
- Users can override provider symbols in settings for exchanges that need a different ticker.
- Validation runs market by market so one unavailable symbol does not block the others.
