# Changelog

## Unreleased

### Production Hardening

- Added error boundaries around dashboard sections and the settings drawer.
- Added offline awareness so cached quotes and local market clocks remain usable.
- Added persisted retry guards to reduce duplicate refresh bursts and repeated tab-open requests.
- Expanded final tests for offline mode, partial API failure, malformed cache handling, settings migration, rate limits, unsupported symbols, and unsupported holiday years.
- Completed release documentation and Chrome Web Store packaging guidance.

### Release Artifacts

- `release/unpacked-extension/`
- `release/market-window-extension.zip`
