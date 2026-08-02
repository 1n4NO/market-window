import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Settings } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { MARKET_DEFINITIONS } from '../config/markets';
import { HOLIDAY_CALENDARS } from '../data/holiday-calendars';
import { useExtensionStorage } from '../hooks/useExtensionStorage';
import { useMarketClockStates } from '../hooks/useMarketClockStates';
import { MarketCardsGrid } from '../components/markets/MarketCardsGrid';
import { SearchField } from '../components/layout/SearchField';
import { IconButton } from '../components/layout/IconButton';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { SettingsDrawer } from '../components/settings/SettingsDrawer';
import { EditMarketsDrawer } from '../components/settings/EditMarketsDrawer';
import { MarketSummaryPanel, QuickLinksPanel, UpcomingTransitionsPanel } from '../components/dashboard/DashboardPanels';
import { MarketHoursTimeline } from '../components/timeline/MarketHoursTimeline';
import { createBundledHolidayProvider } from '../services/holidayProvider/holidayProvider';
import { buildMarketDashboardModel } from '../services/marketDashboard/marketDashboard';
import { classNames } from '../utils/classNames';

const SETTINGS_AVAILABLE_SECTIONS = ['provider', 'appearance', 'quick-links', 'data'] as const;

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
  const viewerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return formatInTimeZone(now, viewerTimeZone, clockFormat === '12h' ? 'hh:mm' : 'HH:mm');
}

function formatClockSuffix(now: Date, timeZone: string, clockFormat: '12h' | '24h'): string {
  const abbreviation = getTimeZoneAbbreviation(now, timeZone);
  if (clockFormat === '24h') {
    return abbreviation;
  }
  const amPm = formatInTimeZone(now, timeZone, 'a');
  return abbreviation ? `${amPm} ${abbreviation}` : amPm;
}

function getTimeZoneCity(timeZone: string): string {
  if (timeZone === 'Asia/Kolkata') {
    return 'Kolkata';
  }
  const city = timeZone.split('/').pop() ?? timeZone;
  return city.replaceAll('_', ' ');
}

function formatUtcOffset(now: Date, timeZone: string): string {
  return `UTC${formatInTimeZone(now, timeZone, 'xxx')}`;
}

function getTimeZoneAbbreviation(now: Date, timeZone: string): string {
  if (timeZone === 'Asia/Kolkata') {
    return 'IST';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  });
  const timeZoneName = formatter.formatToParts(now).find((part) => part.type === 'timeZoneName')?.value ?? '';
  return timeZoneName.replace(/^GMT([+-])/, 'GMT$1');
}

function getFooterFreshnessLabel(quoteStates: string[], usingDemoData: boolean): string {
  if (usingDemoData) {
    return 'Demo data';
  }

  if (quoteStates.includes('delayed')) {
    return 'Data delayed by 15 mins';
  }
  if (quoteStates.includes('end-of-day')) {
    return 'End-of-day data';
  }
  if (quoteStates.includes('cached')) {
    return 'Cached data';
  }
  if (quoteStates.includes('live')) {
    return 'Live data';
  }
  if (quoteStates.includes('unavailable')) {
    return 'Data unavailable';
  }
  return 'Data state varies by market';
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function App() {
  const { snapshot } = useExtensionStorage();
  const [now, setNow] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editMarketsOpen, setEditMarketsOpen] = useState(false);
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
  const greetingLabel = `${greeting} 👋`;
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
  const hasApiKey = Boolean(snapshot.settings.dataProvider.apiKey?.trim());
  const hasDemoQuotes = snapshot.quoteCache.quotes.some((entry) => entry.quote.dataState === 'mock');
  const usingDemoData = !hasApiKey || hasDemoQuotes;
  const providerLabel = usingDemoData
    ? 'Demo mode'
    : hasApiKey
      ? snapshot.settings.dataProvider.providerId === 'twelvedata'
        ? 'Twelve Data'
        : snapshot.settings.dataProvider.providerId
      : 'Demo mode';
  const footerFreshnessLabel = getFooterFreshnessLabel(snapshot.quoteCache.quotes.map((entry) => entry.quote.dataState), usingDemoData);
  const shellDensity = 'gap-[14px]';
  const pagePadding = 'px-[24px] py-[22px]';
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

  return (
    <main className="min-h-screen overflow-x-hidden text-[color:var(--mw-text)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(78,163,255,0.14),transparent_28%),radial-gradient(circle_at_85%_4%,rgba(139,92,246,0.08),transparent_26%),linear-gradient(180deg,rgba(5,8,15,1),rgba(7,11,18,1))]"
        />
      <div className={classNames('relative mx-auto flex w-full max-w-[1400px] flex-col', pagePadding, shellDensity)}>
        <header className="grid gap-1.5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <ErrorBoundary fallbackMessage="The header could not render. The rest of the dashboard is still available." fallbackTitle="Header unavailable">
            <div className="min-w-0 self-start text-left">
              <p className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-[color:var(--mw-text)]">{greetingLabel}</p>
              <p className="mt-1 text-[15px] leading-5 text-[color:var(--mw-text-secondary)]">{formatDate(now)}</p>
            </div>
          </ErrorBoundary>

          <ErrorBoundary fallbackMessage="The clock could not render. The rest of the dashboard is still available." fallbackTitle="Clock unavailable">
            <div className="justify-self-center text-center lg:justify-self-center">
              <h1 className="flex items-end justify-center gap-2 whitespace-nowrap text-[52px] font-semibold leading-[0.9] tracking-[-0.04em] text-[color:var(--mw-text)]">
                <span>{formatClock(now, appearance.clockFormat)}</span>
                <span className="pb-[2px] text-[16px] font-medium tracking-[-0.01em] text-[color:var(--mw-text-secondary)]">
                  {formatClockSuffix(now, viewerTimeZone, appearance.clockFormat)}
                </span>
              </h1>
              <p className="mt-1 text-[13px] leading-5 text-[color:var(--mw-text-secondary)]">
                <span className="font-medium text-[color:var(--mw-text-secondary)]">{formatUtcOffset(now, viewerTimeZone)}</span>
                <span aria-hidden="true" className="mx-2">
                  •
                </span>
                <span>{getTimeZoneCity(viewerTimeZone)}</span>
              </p>
            </div>
          </ErrorBoundary>

          <ErrorBoundary fallbackMessage="The action buttons could not render. The rest of the dashboard is still available." fallbackTitle="Actions unavailable">
            <div className="flex flex-wrap items-start justify-start gap-2 lg:justify-end">
              <IconButton
                className="h-11 border-[color:var(--mw-border)] !bg-white/[0.04] !text-[color:var(--mw-text)] hover:!bg-white/[0.07]"
                onClick={() => {
                  setSettingsOpen(true);
                }}
                tone="subtle"
                type="button"
              >
                <Settings className="h-4 w-4" />
                Settings
              </IconButton>
              <IconButton
                className="h-11 border-[color:var(--mw-border)] !bg-white/[0.04] !text-[color:var(--mw-text)] hover:!bg-white/[0.07]"
                onClick={() => {
                  setEditMarketsOpen(true);
                }}
                tone="subtle"
                type="button"
              >
                <Pencil className="h-4 w-4" />
                Edit Markets
              </IconButton>
            </div>
          </ErrorBoundary>
        </header>

        {appearance.showSearch ? (
          <section className="flex justify-center">
            <div className="w-full max-w-[690px]">
              <ErrorBoundary
                fallbackMessage="The search field could not render. You can still use the dashboard below."
                fallbackTitle="Search unavailable"
              >
                <SearchField ref={searchRef} className="shadow-none" />
              </ErrorBoundary>
            </div>
          </section>
        ) : null}

        <section className="grid gap-3">
          <ErrorBoundary
            fallbackMessage="The market-hours timeline failed to render. The dashboard shell remains available."
            fallbackTitle="Timeline unavailable"
          >
            <MarketHoursTimeline
              className="w-full"
              density={appearance.density}
              marketStates={marketStates}
              markets={enabledMarkets}
              now={now}
              viewerTimeZone={viewerTimeZone}
            />
          </ErrorBoundary>
        </section>

        <section className="grid gap-3">
          <ErrorBoundary
            fallbackMessage="The market cards could not render. Cached clock data and settings are still available."
            fallbackTitle="Market cards unavailable"
          >
            <MarketCardsGrid cards={dashboardModel.cards} now={now} />
          </ErrorBoundary>
        </section>

        <section
          className={classNames(
            'grid gap-3',
            appearance.showQuickLinks ? 'lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,1fr)]' : 'lg:grid-cols-2',
          )}
        >
          <ErrorBoundary
            fallbackMessage="The upcoming transitions panel failed to render. Market clocks remain available."
            fallbackTitle="Transitions unavailable"
          >
            <UpcomingTransitionsPanel now={now} transitions={dashboardModel.transitions} />
          </ErrorBoundary>

          <ErrorBoundary
            fallbackMessage="The market summary panel failed to render. Other dashboard sections are unaffected."
            fallbackTitle="Summary unavailable"
          >
            <MarketSummaryPanel summary={dashboardModel.summary} />
          </ErrorBoundary>

          <ErrorBoundary
            fallbackMessage="The quick-links panel failed to render. Your dashboard still loads normally."
            fallbackTitle="Quick links unavailable"
          >
            <QuickLinksPanel quickLinks={snapshot.settings.quickLinks} visible={appearance.showQuickLinks} />
          </ErrorBoundary>
        </section>

        <ErrorBoundary
          fallbackMessage="The footer failed to render. The dashboard shell remains usable."
          fallbackTitle="Footer unavailable"
        >
          <footer className="flex h-[28px] items-center justify-between gap-3 border-t border-[color:rgba(147,166,197,0.10)] text-[11px] leading-4 text-[color:var(--mw-text-muted)]">
            <p className="min-w-0 truncate">
              <span>All times are local to the exchange</span>
              <span aria-hidden="true" className="mx-2">
                •
              </span>
              <span>{footerFreshnessLabel}</span>
            </p>
            <p className="shrink-0 truncate">
              <span>Provider</span>
              <span aria-hidden="true" className="mx-2">
                •
              </span>
              <span className="text-[color:var(--mw-text-secondary)]">{providerLabel}</span>
              {!hasApiKey ? (
                <>
                  <span aria-hidden="true" className="mx-2">
                    •
                  </span>
                  <span>Free/demo</span>
                </>
              ) : null}
            </p>
          </footer>
        </ErrorBoundary>
      </div>

      <ErrorBoundary
        fallbackMessage="The settings drawer failed to open. Reloading the page will restore access."
        fallbackTitle="Settings unavailable"
        resetKeys={[settingsOpen]}
      >
        <SettingsDrawer
          availableSections={SETTINGS_AVAILABLE_SECTIONS}
          description="Manage provider credentials, appearance, quick links, and local data without reloading the page."
          initialSection="provider"
          open={settingsOpen}
          marketStates={marketStates}
          now={now}
          onClose={() => {
            setSettingsOpen(false);
          }}
          title="Settings"
        />
      </ErrorBoundary>

      <ErrorBoundary
        fallbackMessage="The edit markets drawer failed to open. Reloading the page will restore access."
        fallbackTitle="Edit markets unavailable"
        resetKeys={[editMarketsOpen]}
      >
        <EditMarketsDrawer
          marketStates={marketStates}
          now={now}
          onClose={() => {
            setEditMarketsOpen(false);
          }}
          open={editMarketsOpen}
        />
      </ErrorBoundary>
    </main>
  );
}
