import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { HOLIDAY_CALENDARS } from '../data/holiday-calendars';
import { MARKET_DEFINITIONS } from '../config/markets';
import type { MarketClockState } from '../domain/market';
import { getMarketClockState } from '../services/marketClock/marketClock';
import { createBundledHolidayProvider } from '../services/holidayProvider/holidayProvider';
import { useCountdownText } from '../hooks/useCountdownText';

function formatLocalDateTime(now: Date) {
  return {
    date: format(now, 'EEEE, d MMMM yyyy'),
    time: format(now, 'HH:mm:ss'),
  };
}

const holidayProvider = createBundledHolidayProvider(HOLIDAY_CALENDARS);

export function App() {
  const [now, setNow] = useState(() => new Date());
  const [states, setStates] = useState<Record<string, MarketClockState>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStates() {
      const entries = await Promise.all(
        MARKET_DEFINITIONS.map(
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
  }, [now]);

  const { date, time } = useMemo(() => formatLocalDateTime(now), [now]);

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
                  Temporary phase 2 surface for manually verifying timezone-aware market states,
                  transitions, lunch breaks, weekends, and next-open behavior.
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface/70 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Local time</p>
                <p className="mt-1 font-mono text-2xl tabular-nums">{time}</p>
                <p className="text-sm text-muted">{date}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MARKET_DEFINITIONS.map((market) => {
            const state = states[market.id];
            return (
              <MarketStateCard
                key={market.id}
                marketId={market.id}
                exchangeCode={market.exchangeCode}
                indexName={market.indexName}
                timezone={market.timezone}
                state={state}
                now={now}
              />
            );
          })}
        </section>
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
}: {
  marketId: string;
  exchangeCode: string;
  indexName: string;
  timezone: string;
  state?: MarketClockState;
  now: Date;
}) {
  const countdown = useCountdownText(state?.nextTransitionAt ?? null);

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
