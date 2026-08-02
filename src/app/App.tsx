import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { LayoutGrid, Settings2 } from 'lucide-react';
import { MARKET_DEFINITIONS } from '../config/markets';
import { HOLIDAY_CALENDARS } from '../data/holiday-calendars';
import { useExtensionStorage } from '../hooks/useExtensionStorage';
import { useMarketClockStates } from '../hooks/useMarketClockStates';
import { MarketCardsGrid } from '../components/markets/MarketCardsGrid';
import { SearchField } from '../components/layout/SearchField';
import { Card } from '../components/layout/Card';
import { IconButton } from '../components/layout/IconButton';
import { StatusBadge } from '../components/feedback/StatusBadge';
import { DataStateLabel } from '../components/feedback/DataStateLabel';
import { Countdown } from '../components/feedback/Countdown';
import { EmptyState } from '../components/feedback/EmptyState';
import { SettingsDrawer } from '../components/settings/SettingsDrawer';
import { MarketSummaryPanel, QuickLinksEditorPanel, UpcomingTransitionsPanel } from '../components/dashboard/DashboardPanels';
import { MarketHoursTimeline } from '../components/timeline/MarketHoursTimeline';
import { createBundledHolidayProvider } from '../services/holidayProvider/holidayProvider';
import { buildMarketDashboardModel } from '../services/marketDashboard/marketDashboard';
import { classNames } from '../utils/classNames';

function getGreeting(hour: number): string {
  if (hour < 5) return 'Quiet night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

function formatDate(now: Date): string {
  return format(now, 'EEEE, d MMMM yyyy');
}

function formatClock(now: Date, clockFormat: '12h' | '24h'): string {
  return format(now, clockFormat === '12h' ? 'h:mm:ss a' : 'HH:mm:ss');
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function App() {
  const { controller, snapshot } = useExtensionStorage();
  const [now, setNow] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'markets' | 'appearance' | 'provider' | 'data'>('markets');
  const searchRef = useRef<HTMLInputElement>(null);
  const holidayProvider = useMemo(() => createBundledHolidayProvider(HOLIDAY_CALENDARS), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      if (isEditableElement(event.target)) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const settings = snapshot.settings;
  const appearance = settings.appearance;
  const greeting = getGreeting(now.getHours());
  const enabledMarkets = MARKET_DEFINITIONS.filter((market) => settings.enabledMarketIds.includes(market.id)).sort(
    (left, right) => settings.marketOrder.indexOf(left.id) - settings.marketOrder.indexOf(right.id),
  );
  const marketStates = useMarketClockStates({
    markets: enabledMarkets,
    instant: now,
    holidayProvider,
  });
  const quoteEntries = Object.fromEntries(snapshot.quoteCache.quotes.map((entry) => [entry.marketId, entry])) as Record<
    string,
    (typeof snapshot.quoteCache.quotes)[number] | null
  >;
  const nextTickAt = useMemo(() => new Date(now.getTime() + 1000), [now]);
  const hasApiKey = Boolean(snapshot.settings.dataProvider.apiKey?.trim());
  const providerLabel = hasApiKey
    ? snapshot.settings.dataProvider.providerId === 'twelvedata'
      ? 'Twelve Data'
      : snapshot.settings.dataProvider.providerId
    : 'Demo mode';
  const shellDensity = appearance.density === 'compact' ? 'gap-4' : 'gap-6';
  const pagePadding = appearance.density === 'compact' ? 'px-4 py-4 sm:px-6' : 'px-4 py-5 sm:px-6 lg:px-8';
  const cardPadding = appearance.density === 'compact' ? 'p-4 sm:p-5' : 'p-5 sm:p-6';
  const clockClass = appearance.density === 'compact' ? 'text-4xl sm:text-5xl' : 'text-4xl sm:text-6xl';
  const viewerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dashboardModel = useMemo(
    () =>
      buildMarketDashboardModel({
        markets: enabledMarkets,
        marketStates,
        quoteEntries,
        now,
        viewerTimeZone,
        providerLabel,
      }),
    [enabledMarkets, marketStates, quoteEntries, now, viewerTimeZone, providerLabel],
  );

  async function saveQuickLinks(nextQuickLinks: typeof snapshot.settings.quickLinks): Promise<void> {
    await controller.setSettings({
      ...settings,
      quickLinks: nextQuickLinks.map((link, index) => ({ ...link, order: index })),
    });
  }

  return (
    <main className="min-h-screen overflow-x-hidden text-[color:var(--mw-text)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(78,163,255,0.14),transparent_28%),radial-gradient(circle_at_85%_4%,rgba(139,92,246,0.08),transparent_26%),linear-gradient(180deg,rgba(5,8,15,1),rgba(7,11,18,1))]"
      />
      <div className={classNames('relative mx-auto flex w-full max-w-7xl flex-col', pagePadding, shellDensity)}>
        <header className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_auto] xl:items-start">
          <Card className={classNames(cardPadding, 'relative overflow-hidden')}>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(78,163,255,0.08),transparent_38%,rgba(139,92,246,0.06))]" />
            <div className="relative flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <StatusBadge tone={hasApiKey ? 'accent' : 'neutral'}>{hasApiKey ? 'Provider connected' : 'Demo data'}</StatusBadge>
                  <div className="space-y-2">
                    <p className="text-sm text-[color:var(--mw-text-secondary)]">{greeting}</p>
                    <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-[color:var(--mw-text)] sm:text-4xl">
                      A calm market-hours dashboard for your new tab.
                    </h1>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-[color:var(--mw-text-secondary)]">
                    Search from the header, jump to a URL, or open settings to tune the shell. Market cards, summary, and
                    transitions are live below.
                  </p>
                </div>
                <div className="rounded-[20px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-raised)] px-4 py-3 shadow-[var(--mw-shadow-lift)]">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Local time</p>
                  <p className={classNames('mt-2 font-mono tabular-nums leading-none', clockClass)}>
                    {formatClock(now, appearance.clockFormat)}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--mw-text-secondary)]">{formatDate(now)}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Next tick</p>
                  <p className="mt-1 text-sm text-[color:var(--mw-text)]">
                    <Countdown targetAt={nextTickAt.toISOString()} now={now} />
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <IconButton
                  onClick={() => {
                    setSettingsSection('markets');
                    setSettingsOpen(true);
                  }}
                  type="button"
                >
                  <Settings2 className="h-4 w-4" />
                  Settings
                </IconButton>
                <IconButton
                  onClick={() => {
                    setSettingsSection('markets');
                    setSettingsOpen(true);
                  }}
                  type="button"
                  tone="subtle"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Edit Markets
                </IconButton>
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className={classNames(cardPadding, 'min-h-[180px]')}>
              <div className="flex h-full flex-col justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">At a glance</p>
                  <h2 className="text-xl font-semibold text-[color:var(--mw-text)]">Your search bar, front and center</h2>
                  <p className="max-w-md text-sm leading-6 text-[color:var(--mw-text-secondary)]">
                    Focus the search field with <kbd className="rounded border border-[color:var(--mw-border)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--mw-text)]">/</kbd>.
                    Type a site address to jump straight there, or search Google when the input is plain text.
                  </p>
                </div>
                {appearance.showSearch ? (
                  <SearchField ref={searchRef} className="shadow-none" />
                ) : (
                  <EmptyState
                    title="Search is hidden"
                    description="Turn the search field back on from Settings if you want the quick URL/search launcher in the header."
                  />
                )}
              </div>
            </Card>

            <Card className={classNames(cardPadding, 'space-y-4')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Provider</p>
                  <h2 className="text-lg font-semibold text-[color:var(--mw-text)]">Data source</h2>
                </div>
                <StatusBadge tone={hasApiKey ? 'positive' : 'neutral'}>{providerLabel}</StatusBadge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Data state</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <DataStateLabel state={hasApiKey ? 'cached' : 'mock'} />
                    <DataStateLabel state="delayed" />
                    <DataStateLabel state="end-of-day" />
                  </div>
                </div>
                <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Last refresh</p>
                  <p className="mt-3 font-mono tabular-nums text-sm text-[color:var(--mw-text)]">
                    {snapshot.quoteCache.lastSuccessfulRefreshAt ?? 'No refresh yet'}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--mw-text-secondary)]">
                    Cached quotes are preserved locally and updated in the background when a provider key is present.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </header>

        <section className="grid gap-4">
          <MarketHoursTimeline
            className="w-full"
            density={appearance.density}
            marketStates={marketStates}
            markets={enabledMarkets}
            now={now}
            viewerTimeZone={viewerTimeZone}
          />
        </section>

        <section className="grid gap-4">
          <MarketCardsGrid cards={dashboardModel.cards} now={now} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <QuickLinksEditorPanel
            onChange={(nextQuickLinks) => {
              void saveQuickLinks(nextQuickLinks);
            }}
            quickLinks={snapshot.settings.quickLinks}
            visible={appearance.showQuickLinks}
          />

          <div className="grid gap-4">
            <MarketSummaryPanel summary={dashboardModel.summary} />
            <UpcomingTransitionsPanel now={now} transitions={dashboardModel.transitions} />
            <Card className={classNames(cardPadding, 'space-y-4')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Shell</p>
                  <h2 className="text-lg font-semibold text-[color:var(--mw-text)]">Layout settings</h2>
                </div>
                <StatusBadge tone="neutral">{appearance.clockFormat}</StatusBadge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Density</p>
                  <p className="mt-3 text-sm font-medium text-[color:var(--mw-text)]">{appearance.density}</p>
                </div>
                <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Provider</p>
                  <p className="mt-3 text-sm font-medium text-[color:var(--mw-text)]">{providerLabel}</p>
                </div>
              </div>
              <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Motion</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--mw-text-secondary)]">
                  Reduced-motion preferences keep transitions subdued while preserving the same hierarchy and information.
                </p>
              </div>
            </Card>
          </div>
        </section>

        <footer className={classNames('grid gap-4 rounded-[22px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)]', cardPadding)}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Footer</p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={hasApiKey ? 'positive' : 'neutral'}>Provider: {providerLabel}</StatusBadge>
                <StatusBadge tone="neutral">Data-state legend</StatusBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                <DataStateLabel state={hasApiKey ? 'cached' : 'mock'} />
                <DataStateLabel state="delayed" />
                <DataStateLabel state="end-of-day" />
              </div>
            </div>
            <div className="grid gap-1 text-sm text-[color:var(--mw-text-secondary)]">
              <p>
                Latest successful refresh: <span className="font-mono tabular-nums text-[color:var(--mw-text)]">{snapshot.quoteCache.lastSuccessfulRefreshAt ?? 'none'}</span>
              </p>
              <p>Market information is for informational purposes only.</p>
              <p>Twelve Data attribution applies when the provider is selected.</p>
            </div>
          </div>
        </footer>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        initialSection={settingsSection}
        marketStates={marketStates}
        now={now}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
    </main>
  );
}
