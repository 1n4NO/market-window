# Market Window

Market Window is a Chrome Manifest V3 new-tab extension foundation for a global market-hours dashboard.

## Phase 0

This phase sets up the repository foundation only:

- React
- TypeScript
- Vite
- Tailwind CSS
- Chrome Manifest V3
- strict TypeScript, ESLint, Prettier, Vitest, and React Testing Library
- a minimal new-tab shell

Market logic, API integration, caching, and settings will be added in later phases.

## Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the extension:

   ```bash
   npm run build
   ```

3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click `Load unpacked`.
6. Select the project `dist` folder.

## Development

Start the Vite dev server:

```bash
npm run dev
```

## Production Build

Create the production bundle with:

```bash
npm run build
```

## Tests and Checks

Run the full local verification set with:

```bash
npm run lint
npm run typecheck
npm run test
```

## Packaging

Create a ZIP package with:

```bash
npm run package
```

## Market Configuration

Market definitions, session schedules, provider-symbol mappings, and validation rules live in `MARKET_CALENDARS.md` and `src/config/markets.ts`.

Holiday calendar bundles can be validated with:

```bash
npm run validate:holidays
```

## Unpacked Extension

After building, load the `dist` folder as an unpacked extension in Chrome. The extension overrides the browser new-tab page through `newtab.html`.
