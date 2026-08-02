import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

function formatLocalDateTime(now: Date) {
  return {
    date: format(now, 'EEEE, d MMMM yyyy'),
    time: format(now, 'HH:mm:ss'),
  };
}

export function App() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { date, time } = useMemo(() => formatLocalDateTime(now), [now]);

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <section className="rounded-[1.75rem] border border-line bg-[radial-gradient(circle_at_top,rgba(78,163,255,0.15),transparent_38%),linear-gradient(180deg,rgba(11,18,32,0.98),rgba(5,8,15,0.98))] p-6 shadow-glow sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-sm uppercase tracking-[0.2em] text-muted">Market Window</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">New tab dashboard shell</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted">
                Phase 0 foundation: React, TypeScript, Vite, Tailwind CSS, and the Chrome extension
                scaffold are in place. Market logic arrives in a later phase.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Local date" value={date} />
              <StatCard label="Local time" value={time} mono />
              <StatCard label="Status" value="Temporary dashboard placeholder" />
            </div>

            <div className="rounded-2xl border border-line bg-surface/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted">Dashboard content</p>
                  <h2 className="mt-1 text-lg font-semibold">Placeholder shell only</h2>
                </div>
                <span className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted">
                  Phase 0
                </span>
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-sm leading-6 text-muted">
                This phase establishes the extension entry point and visual shell. Later phases will
                replace this area with market hours, cards, settings, data provider integration, and
                caching logic.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={`mt-3 text-lg font-medium ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</p>
    </div>
  );
}
