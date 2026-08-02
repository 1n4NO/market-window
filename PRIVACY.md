# Privacy

Market Window is designed as a local-only browser extension.

## What The Extension Does Not Collect

- No browsing history
- No page contents from normal websites
- No analytics
- No authentication data
- No remote telemetry

## What Stays Local

- Settings remain in `chrome.storage.local`
- Market enablement and order remain local
- Quick links remain local
- Quote cache entries remain local
- Provider selection and API-key entry remain local

## API Keys

- The user may enter a personal Twelve Data API key.
- The key is stored in browser-local extension storage.
- That storage is convenient for persistence, but it does not make the key secret from someone who can inspect the browser profile or extension state.
- The key is not exported unless the user explicitly chooses to include secrets.

## Market-Data Requests

- Requests go directly from the browser to the selected provider.
- No backend server intermediates the request.
- No scripts are loaded remotely.

## Page Modification

- The extension replaces only the browser's new-tab page.
- It does not inject scripts into other websites.
- It does not modify normal page content.

## Exports

- Settings are only exported when the user explicitly chooses export.
- Imported settings are validated before they are written back to local storage.
