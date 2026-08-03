import { useSyncExternalStore, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MARKET_DEFINITIONS } from '../../config/markets';
import type { MarketClockState } from '../../domain/market';
import {
  ExtensionStorageController,
  createMemoryStorageAdapter,
} from '../../services/storage/extensionStorage';
import { SettingsDrawer } from './SettingsDrawer';

const harness = vi.hoisted(() => {
  return {
    controller: null as ExtensionStorageController | null,
    quoteCacheService: null as
      | {
          refreshQuotes: ReturnType<typeof vi.fn>;
          validateConfiguredSymbols: ReturnType<typeof vi.fn>;
        }
      | null,
    twelvedataProvider: null as
      | {
          id: string;
          capabilities: {
            quotes: boolean;
            historicalSeries: boolean;
            marketMovers: boolean;
            moverUniverse: 'exchange' | 'index-constituents' | 'provider-defined' | 'unsupported';
          };
          validateApiKey: ReturnType<typeof vi.fn>;
          fetchQuote: ReturnType<typeof vi.fn>;
        }
      | null,
    mockProvider: null as
      | {
          id: string;
          capabilities: {
            quotes: boolean;
            historicalSeries: boolean;
            marketMovers: boolean;
            moverUniverse: 'exchange' | 'index-constituents' | 'provider-defined' | 'unsupported';
          };
          validateApiKey: ReturnType<typeof vi.fn>;
          fetchQuote: ReturnType<typeof vi.fn>;
        }
      | null,
  };
});

vi.mock('../../hooks/useExtensionStorage', () => ({
  useExtensionStorage: () => {
    const controller = harness.controller;
    if (!controller) {
      throw new Error('Settings drawer test harness controller was not initialized.');
    }
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    return { controller, snapshot };
  },
}));

vi.mock('../../services/marketData', () => ({
  MARKET_DATA_PROVIDERS: {
    mock: harness.mockProvider,
    twelvedata: harness.twelvedataProvider,
  },
  createMarketQuoteCacheService: () => harness.quoteCacheService,
  getMarketDataProvider: (providerId: string) => {
    if (providerId === 'mock') {
      return harness.mockProvider;
    }
    if (providerId === 'twelvedata') {
      return harness.twelvedataProvider;
    }
    return null;
  },
  resolveActiveMarketDataProviderId: (providerId: string, apiKey: string | null) =>
    apiKey && apiKey.trim().length > 0 ? providerId : 'mock',
}));

function createClockState(marketId: string): MarketClockState {
  const market = MARKET_DEFINITIONS.find((entry) => entry.id === marketId);
  if (!market) {
    throw new Error(`Missing market definition: ${marketId}`);
  }

  return {
    state: 'open',
    nextTransitionAt: '2026-08-02T10:00:00.000Z',
    previousTransitionAt: '2026-08-02T03:30:00.000Z',
    millisecondsUntilTransition: 3_600_000,
    activeSession: market.sessions[0] ?? null,
    nextSession: null,
    nextAction: 'Closes in 1h',
    holidayConfidence: 'confirmed',
  };
}

function createMarketStates(): Record<string, MarketClockState> {
  return Object.fromEntries(MARKET_DEFINITIONS.map((market) => [market.id, createClockState(market.id)]));
}

function TestHarness({
  initialSection,
  onClose,
}: {
  initialSection: 'markets' | 'appearance' | 'provider' | 'data';
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <SettingsDrawer
      initialSection={initialSection}
      marketStates={createMarketStates()}
      now={new Date('2026-08-02T09:00:00.000Z')}
      onClose={() => {
        setOpen(false);
        onClose?.();
      }}
      open={open}
    />
  );
}

describe('SettingsDrawer', () => {
  beforeEach(async () => {
    const adapter = createMemoryStorageAdapter();
    harness.controller = new ExtensionStorageController(adapter);
    harness.quoteCacheService = {
      refreshQuotes: vi.fn(async ({ markets }: { markets: { id: string }[] }) =>
        markets.map((market) => ({
          marketId: market.id,
          status: 'updated',
          quote: null,
          entry: null,
          stale: false,
          error: null,
        })),
      ),
      validateConfiguredSymbols: vi.fn(async (markets: { id: string }[]) =>
        markets.map((market, index) => ({
          marketId: market.id,
          providerId: 'twelvedata',
          symbol: `SYM-${market.id}`,
          valid: index !== 0,
          message: index === 0 ? `Symbol unavailable for ${market.id.toUpperCase()}.` : null,
        })),
      ),
    };
    harness.twelvedataProvider = {
      id: 'twelvedata',
      capabilities: {
        quotes: true,
        historicalSeries: false,
        marketMovers: false,
        moverUniverse: 'unsupported',
      },
      validateApiKey: vi.fn(async (apiKey: string) => {
        if (apiKey === 'bad-key') {
          return {
            valid: false,
            code: 'invalid_api_key',
            message: 'Invalid API key.',
          };
        }
        if (apiKey === 'rate-key') {
          return {
            valid: false,
            code: 'rate_limited',
            message: 'Rate limit reached.',
          };
        }
        return {
          valid: true,
          code: 'valid',
          message: 'Connection successful.',
        };
      }),
      fetchQuote: vi.fn(),
    };
    harness.mockProvider = {
      id: 'mock',
      capabilities: {
        quotes: true,
        historicalSeries: false,
        marketMovers: false,
        moverUniverse: 'unsupported',
      },
      validateApiKey: vi.fn(async () => ({
        valid: true,
        code: 'valid',
        message: 'Demo provider does not require an API key.',
      })),
      fetchQuote: vi.fn(),
    };
    const controller = harness.controller;
    if (!controller) {
      throw new Error('Settings drawer test harness controller was not initialized.');
    }
    await controller.ready();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('supports the full provider key workflow and restores default symbols', async () => {
    const user = userEvent.setup();
    render(<TestHarness initialSection="provider" />);
    const controller = harness.controller;
    if (!controller) {
      throw new Error('Settings drawer test harness controller was not initialized.');
    }

    const apiKeyInput = screen.getByLabelText('API key');
    expect(apiKeyInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show API key' }));
    expect(apiKeyInput).toHaveAttribute('type', 'text');

    await user.clear(apiKeyInput);
    await user.type(apiKeyInput, 'bad-key');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(screen.getAllByText(/Invalid API key/i).length).toBeGreaterThan(0);

    await user.clear(apiKeyInput);
    await user.type(apiKeyInput, 'rate-key');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(screen.getAllByText(/Rate limit reached/i).length).toBeGreaterThan(0);

    await user.clear(apiKeyInput);
    await user.type(apiKeyInput, 'good-key');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(screen.getAllByText(/Connection successful/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Symbol unavailable for NSE/i).length).toBeGreaterThan(0);

    const nseOverride = screen.getAllByLabelText('Symbol override')[0];
    fireEvent.change(nseOverride, { target: { value: 'BROKEN-SYMBOL' } });
    await waitFor(() => {
      expect(controller.getSnapshot().settings.providerSymbolOverrides.nse?.twelvedata).toBe('BROKEN-SYMBOL');
    });

    await user.click(screen.getByRole('button', { name: 'Restore default symbols' }));
    expect(controller.getSnapshot().settings.providerSymbolOverrides).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Remove key' }));
    expect(controller.getSnapshot().settings.dataProvider.apiKey).toBeNull();
  });

  it('warns before destructive actions', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const controller = harness.controller;
    if (!controller) {
      throw new Error('Settings drawer test harness controller was not initialized.');
    }
    const clearQuoteCacheSpy = vi.spyOn(controller, 'clearQuoteCache');
    const resetPreferencesSpy = vi.spyOn(controller, 'resetPreferences');
    const clearAllSpy = vi.spyOn(controller, 'clearAllExtensionData');

    render(<TestHarness initialSection="data" />);

    await user.click(screen.getByRole('button', { name: 'Clear quote cache' }));
    await user.click(screen.getByRole('button', { name: 'Reset preferences' }));
    await user.click(screen.getByRole('button', { name: 'Clear all extension data' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(clearQuoteCacheSpy).not.toHaveBeenCalled();
    expect(resetPreferencesSpy).not.toHaveBeenCalled();
    expect(clearAllSpy).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);

    await user.click(screen.getByRole('button', { name: 'Clear quote cache' }));
    await user.click(screen.getByRole('button', { name: 'Reset preferences' }));
    await user.click(screen.getByRole('button', { name: 'Clear all extension data' }));

    expect(clearQuoteCacheSpy).toHaveBeenCalled();
    expect(resetPreferencesSpy).toHaveBeenCalled();
    expect(clearAllSpy).toHaveBeenCalled();
  });

  it('restores focus to the trigger after closing', async () => {
    const user = userEvent.setup();
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Open settings';
    document.body.appendChild(trigger);
    trigger.focus();

    render(<TestHarness initialSection="markets" />);

    await user.click(screen.getByRole('button', { name: 'Close Settings' }));

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });

    trigger.remove();
  });
});
