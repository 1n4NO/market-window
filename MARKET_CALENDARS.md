# Market Calendars

This project keeps market schedules in `src/config/markets.ts`, not in components.

## Adding Another Market

1. Add a new `MarketDefinition` entry in `src/config/markets.ts`.
2. Give the market a stable `id`.
3. Set the display metadata:
   - `exchangeCode`
   - `country`
   - `indexName`
   - `timezone`
   - `colorToken`
   - `iconId`
4. Define one or more `SessionDefinition` entries.
   - Use explicit weekday names.
   - Use `HH:mm` times.
   - Add multiple sessions when the market has a lunch break or split session.
5. Add one or more `ProviderSymbol` mappings.
   - Do not assume the same symbol works for every provider.
   - Mark the preferred mapping with `isDefault` if helpful.
6. If you have holiday data, add a `HolidayDefinition` entry in the same typed domain model layer and wire it into the later holiday provider phase.
7. Run validation through `validateMarketDefinition` or `validateMarketDefinitions` before saving imported or edited configuration.

## Validation Rules

- Market ids must be unique.
- Session ids must be unique within a market.
- Provider ids must be unique within a market.
- Weekdays must be explicit and valid.
- Session times must use `HH:mm`.
- Arrays such as sessions, provider symbols, and quick links must not be empty when required.

## Provider Symbols

Provider symbols are intentionally configurable because data vendors use different ticker formats.

Examples:

- Twelve Data may use exchange-prefixed symbols.
- Another provider may use a plain index code.

Keep those mappings in configuration, not in UI code.
