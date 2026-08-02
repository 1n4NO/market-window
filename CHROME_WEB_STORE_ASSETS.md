# Chrome Web Store Assets Checklist

Use this checklist before upload:

## Icons

- [ ] 16x16
- [ ] 32x32
- [ ] 48x48
- [ ] 128x128

## Screenshots

- [ ] At least one wide screenshot of the dashboard
- [ ] At least one screenshot that shows settings or another key interaction
- [ ] Images reflect the current release build

## Listing Copy

- [ ] Short description
- [ ] Detailed description
- [ ] Clear release summary
- [ ] Honest mention of demo mode and data delays

## Privacy Disclosure

- [ ] State that no browsing history is collected
- [ ] State that no normal pages are modified
- [ ] State that API keys remain in local extension storage
- [ ] State that requests go directly from the browser to the provider
- [ ] State that settings remain local unless explicitly exported

## Permission Justification

- [ ] Justify `storage`
- [ ] Justify the Twelve Data host permission
- [ ] Confirm no browsing-history, active-tab, or content-script permissions are requested

## Final Release Validation

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run package`
- [ ] Verify `release/unpacked-extension/`
- [ ] Verify `release/market-window-extension.zip`
