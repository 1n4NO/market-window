import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { HOLIDAY_CALENDARS } from '../data/holiday-calendars';
import { MARKET_DEFINITIONS } from '../config/markets';
import type { MarketClockState, MarketQuote } from '../domain/market';
import { getMarketClockState } from '../services/marketClock/marketClock';
import { createBundledHolidayProvider } from '../services/holidayProvider/holidayProvider';
import { useCountdownText } from '../hooks/useCountdownText';
import { useExtensionStorage } from '../hooks/useExtensionStorage';
import { DeveloperSettingsPanel } from '../components/settings/DeveloperSettingsPanel';
import { createMarketQuoteCacheService } from '../services/marketData/quoteCache';
import { MARKET_DATA_PROVIDERS, resolveActiveMarketDataProviderId } from '../services/marketData/providerRegistry';
import { getDefaultStorageController } from '../services/storage/extensionStorage';

function formatLocalDateTime(now: Date) {
  return {
    date: format(now, 'EEEE, d MMMM yyyy'),
    time: format(now, 'HH:mm:ss'),
  };
}

const holidayProvider = createBundledHolidayProvider(HOLIDAY_CALENDARS);

export function App() {
  const [now, setNow] = useState(() => new Date());
  const [quoteRefreshNonce, setQuoteRefreshNonce] = useState(0);
  const { snapshot } = useExtensionStorage();
  const [states, setStates] = useState<Record<string, MarketClockState>>({});
  const quoteCacheService = useMemo(
    () => createMarketQuoteCacheService(getDefaultStorageController(), MARKET_DATA_PROVIDERS),
    [],
  );
  const visibleMarkets = useMemo(() => {
    const enabled = new Set(snapshot.settings.enabledMarketIds);
    const order = new Map(snapshot.settings.marketOrder.map((marketId, index) => [marketId, index]));

    return MARKET_DEFINITIONS.filter((market) => enabled.has(market.id)).sort(
      (left, right) => (order.get(left.id) ?? Number.POSITIVE_INFINITY) - (order.get(right.id) ?? Number.POSITIVE_INFINITY),
    );
  }, [snapshot.settings.enabledMarketIds, snapshot.settings.marketOrder]);
  const quoteEntriesByMarketId = useMemo(() => {
    return Object.fromEntries(snapshot.quoteCache.quotes.map((entry) => [entry.marketId, entry] as const));
  }, [snapshot.quoteCache.quotes]);
  const statesRef = useRef(states);
  const nowRef = useRef(now);
  const statesReady = useMemo(
    () => visibleMarkets.every((market) => states[market.id] !== undefined),
    [states, visibleMarkets],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  useEffect(() => {
    nowRef.current = now;
  }, [now]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQuoteRefreshNonce((value) => value + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStates() {
      const entries = await Promise.all(
        visibleMarkets.map(
          async (market) => [market.id, await getMarketClockState(market, now, holidayProvider)] as const,
        ),
      );

      if (!cancelled) {
        setStates(Object.fromEntries(entries));
      }
    }

    void loadStates();

    return () => {
      cancelled = true;
    };
  }, [now, visibleMarkets]);

  useEffect(() => {
    let cancelled = false;
    const activeProviderId = resolveActiveMarketDataProviderId(
      snapshot.settings.dataProvider.providerId,
      snapshot.settings.dataProvider.apiKey,
    );

    async function refreshQuotes() {
      await quoteCacheService.refreshQuotes({
        markets: visibleMarkets,
        marketStates: statesRef.current,
        providerId: activeProviderId,
        apiKey: snapshot.settings.dataProvider.apiKey ?? '',
        now: nowRef.current,
        overrides: snapshot.settings.providerSymbolOverrides,
      });
    }

    void refreshQuotes().catch(() => {
      if (!cancelled) {
        return;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    quoteRefreshNonce,
    quoteCacheService,
    visibleMarkets,
    snapshot.settings.dataProvider.apiKey,
    snapshot.settings.dataProvider.providerId,
    snapshot.settings.providerSymbolOverrides,
    statesReady,
  ]);

  const { date, time } = useMemo(() => formatLocalDateTime(now), [now]);
  const activeProviderId = resolveActiveMarketDataProviderId(
    snapshot.settings.dataProvider.providerId,
    snapshot.settings.dataProvider.apiKey,
  );

  return (
    <main className="min-h-screen bg-bg px-5 py-6 text-text sm:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[1.75rem] border border-line bg-[radial-gradient(circle_at_top,rgba(78,163,255,0.15),transparent_38%),linear-gradient(180deg,rgba(11,18,32,0.98),rgba(5,8,15,0.98))] p-6 shadow-glow sm:p-8">
          <div className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.2em] text-muted">Market Window</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Clock engine developer view</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                  Temporary phase 5 surface for manually verifying timezone-aware market states,
                  transitions, lunch breaks, cached quotes, provider normalization, and next-open behavior.
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface/70 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Local time</p>
                <p className="mt-1 font-mono text-2xl tabular-nums">{time}</p>
                <p className="text-sm text-muted">{date}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">Data provider</p>
                <p className="text-sm text-text">{activeProviderId}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleMarkets.map((market) => {
            const state = states[market.id];
            const quoteEntry = quoteEntriesByMarketId[market.id];
            return (
              <MarketStateCard
                key={market.id}
                marketId={market.id}
                exchangeCode={market.exchangeCode}
                indexName={market.indexName}
                timezone={market.timezone}
                state={state}
                now={now}
                quoteEntry={quoteEntry}
              />
            );
          })}
          {visibleMarkets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-5 text-sm text-muted md:col-span-2 xl:col-span-3">
              No markets are enabled. Use the developer settings panel below to re-enable a market.
            </div>
          ) : null}
        </section>

        <DeveloperSettingsPanel />
      </div>
    </main>
  );
}

function MarketStateCard({
  marketId,
  exchangeCode,
  indexName,
  timezone,
  state,
  now,
  quoteEntry,
}: {
  marketId: string;
  exchangeCode: string;
  indexName: string;
  timezone: string;
  state?: MarketClockState;
  now: Date;
  quoteEntry?: {
    marketId: string;
    quote: MarketQuote;
    fetchedAt: string;
    providerTimestamp: string | null;
    expiresAt: string | null;
    providerId: string;
  };
}) {
  const countdown = useCountdownText(state?.nextTransitionAt ?? null);
  const quote = quoteEntry?.quote ?? null;
  const valueLabel = quote && quote.value !== null ? quote.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'n/a';
  const changeLabel =
    quote && quote.absoluteChange !== null
      ? `${quote.absoluteChange >= 0 ? '+' : ''}${quote.absoluteChange.toFixed(2)}`
      : 'n/a';
  const percentLabel =
    quote && quote.percentageChange !== null
      ? `${quote.percentageChange >= 0 ? '+' : ''}${quote.percentageChange.toFixed(2)}%`
      : 'n/a';

  return (
    <article className="rounded-2xl border border-line bg-surface/70 p-5 shadow-glow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">{exchangeCode}</p>
          <h2 className="mt-1 text-xl font-semibold">{indexName}</h2>
          <p className="mt-1 text-sm text-muted">{timezone}</p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted">
          {state?.state ?? 'loading'}
        </span>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <DetailRow label="Market id" value={marketId} mono />
        <DetailRow label="Next transition" value={state?.nextTransitionAt ?? 'n/a'} mono />
        <DetailRow label="Previous transition" value={state?.previousTransitionAt ?? 'n/a'} mono />
        <DetailRow label="Milliseconds left" value={state?.millisecondsUntilTransition?.toString() ?? 'n/a'} mono />
        <DetailRow label="Active session" value={state?.activeSession?.label ?? 'none'} />
        <DetailRow label="Next session" value={state?.nextSession?.label ?? 'none'} />
        <DetailRow label="Next action" value={state?.nextAction ?? 'n/a'} />
        <DetailRow label="Holiday confidence" value={state?.holidayConfidence ?? 'unknown'} />
        <DetailRow label="Countdown" value={countdown ?? 'n/a'} mono />
        <DetailRow label="Snapshot time" value={format(now, 'HH:mm:ss')} mono />
      </dl>

      <div className="mt-5 rounded-xl border border-line/70 bg-bg/50 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Quote cache</p>
        <div className="mt-3 grid gap-2 text-sm">
          <DetailRow label="Value" value={valueLabel} mono />
          <DetailRow label="Change" value={changeLabel} mono />
          <DetailRow label="Percent" value={percentLabel} mono />
          <DetailRow label="Data state" value={quote?.dataState ?? 'unavailable'} />
          <DetailRow label="Provider" value={quote?.provider ?? 'n/a'} />
          <DetailRow label="Quote time" value={quote?.asOf ?? 'n/a'} mono />
          <DetailRow label="Cache fetched" value={quoteEntry?.fetchedAt ?? 'n/a'} mono />
          <DetailRow label="Cache expiry" value={quoteEntry?.expiresAt ?? 'n/a'} mono />
        </div>
      </div>
    </article>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</dd>
    </div>
  );
}
