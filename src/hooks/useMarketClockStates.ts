import { useEffect, useState } from 'react';
import type { HolidayProvider } from '../services/holidayProvider/holidayProvider';
import { getMarketClockState } from '../services/marketClock/marketClock';
import type { MarketClockState, MarketDefinition } from '../domain/market';

export function useMarketClockStates({
  markets,
  instant,
  holidayProvider,
}: {
  markets: MarketDefinition[];
  instant: Date;
  holidayProvider?: HolidayProvider;
}): Record<string, MarketClockState> {
  const [states, setStates] = useState<Record<string, MarketClockState>>({});

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      const entries = await Promise.all(
        markets.map(async (market) => [market.id, await getMarketClockState(market, instant, holidayProvider)] as const),
      );
      if (!cancelled) {
        setStates(Object.fromEntries(entries));
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [holidayProvider, instant, markets]);

  return states;
}
