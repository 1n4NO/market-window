import { useEffect, useState } from 'react';
import type { QuickLink } from '../../domain/market';
import type { MarketSummaryModel, MarketTransitionItem } from '../../services/marketDashboard/marketDashboard';
import { Countdown } from '../feedback/Countdown';
import { EmptyState } from '../feedback/EmptyState';
import { StatusBadge } from '../feedback/StatusBadge';
import { Card } from '../layout/Card';
import { IconButton } from '../layout/IconButton';

function createDefaultQuickLink(index: number): QuickLink {
  return {
    id: `shortcut-${Date.now()}-${index}`,
    label: 'New link',
    url: 'https://www.google.com',
    enabled: true,
    order: index,
  };
}

function getStateText(state: MarketTransitionItem['state']): string {
  switch (state) {
    case 'open':
      return 'Open';
    case 'pre-market':
      return 'Pre-market';
    case 'lunch-break':
      return 'On break';
    case 'closed':
      return 'Closed';
    case 'weekend':
      return 'Weekend';
    case 'holiday':
      return 'Holiday';
    default:
      return 'Unknown';
  }
}

export function UpcomingTransitionsPanel({
  transitions,
  now,
}: {
  transitions: MarketTransitionItem[];
  now: Date;
}) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Upcoming transitions</p>
          <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Next four events</h3>
        </div>
        <StatusBadge tone="neutral">{transitions.length}</StatusBadge>
      </div>
      {transitions.length > 0 ? (
        <ol className="space-y-2">
          {transitions.map((transition) => (
            <li
              key={`${transition.marketId}-${transition.transitionAt}`}
              className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[color:var(--mw-text)]">
                    {transition.exchangeCode} {transition.actionLabel.replace(`${transition.exchangeCode} `, '')}
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">{transition.country}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm tabular-nums text-[color:var(--mw-text)]">
                    <Countdown now={now} targetAt={transition.transitionAt} />
                  </p>
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">{getStateText(transition.state)}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No transitions"
          description="No enabled market has an upcoming transition within the current timeline window."
        />
      )}
    </Card>
  );
}

export function MarketSummaryPanel({
  summary,
}: {
  summary: MarketSummaryModel;
}) {
  const closedPercent = Math.max(0, Math.min(100, summary.closedPercentage));
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Market summary</p>
          <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Open and closed overview</h3>
        </div>
        <StatusBadge tone="neutral">{summary.total} total</StatusBadge>
      </div>

      <div className="flex items-center gap-4">
        <div
          aria-label={`Closed markets represent ${closedPercent}% of enabled markets`}
          className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)]"
          style={{
            background: `conic-gradient(var(--mw-negative) 0 ${closedPercent}%, rgba(255,255,255,0.06) ${closedPercent}% 100%)`,
          }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] text-center">
            <div>
              <p className="text-lg font-semibold text-[color:var(--mw-text)]">{closedPercent}%</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">closed</p>
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <Stat label="Open" value={summary.open} />
          <Stat label="Closed" value={summary.closed} />
          <Stat label="On break" value={summary.onBreak} />
          <Stat label="Opening < 3h" value={summary.openingWithinThreeHours} />
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">{label}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums text-[color:var(--mw-text)]">{value}</p>
    </div>
  );
}

export function QuickLinksEditorPanel({
  quickLinks,
  onChange,
  visible,
}: {
  quickLinks: QuickLink[];
  visible: boolean;
  onChange: (next: QuickLink[]) => void;
}) {
  const [draft, setDraft] = useState<QuickLink[]>(quickLinks);

  useEffect(() => {
    setDraft(quickLinks);
  }, [quickLinks]);

  if (!visible) {
    return (
      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Quick links</p>
          <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Hidden</h3>
        </div>
        <EmptyState
          title="Quick links are hidden"
          description="Turn them back on from settings to edit shortcuts here."
        />
      </Card>
    );
  }

  function update(nextDraft: QuickLink[]): void {
    setDraft(nextDraft);
    onChange(nextDraft);
  }

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Quick links</p>
          <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">Editable shortcuts</h3>
        </div>
        <StatusBadge tone="neutral">{draft.filter((link) => link.enabled).length} visible</StatusBadge>
      </div>

      <div className="space-y-2">
        {draft.length > 0 ? (
          draft.map((link, index) => (
            <div
              key={link.id}
              className="grid gap-2 rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-3"
            >
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                  <input
                    checked={link.enabled}
                    className="h-4 w-4 rounded border-[color:var(--mw-border)] bg-transparent text-[color:var(--mw-focus)]"
                    onChange={(event) => {
                      const next = [...draft];
                      next[index] = { ...link, enabled: event.target.checked };
                      update(next);
                    }}
                    type="checkbox"
                  />
                  Enabled
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <IconButton
                    aria-label="Move link up"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...draft];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      update(next.map((item, itemIndex) => ({ ...item, order: itemIndex })));
                    }}
                    tone="subtle"
                    type="button"
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    aria-label="Move link down"
                    disabled={index === draft.length - 1}
                    onClick={() => {
                      const next = [...draft];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      update(next.map((item, itemIndex) => ({ ...item, order: itemIndex })));
                    }}
                    tone="subtle"
                    type="button"
                  >
                    ↓
                  </IconButton>
                  <IconButton
                    aria-label="Remove link"
                    onClick={() => {
                      update(draft.filter((item) => item.id !== link.id).map((item, itemIndex) => ({ ...item, order: itemIndex })));
                    }}
                    tone="subtle"
                    type="button"
                  >
                    ×
                  </IconButton>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                  Label
                  <input
                    className="rounded-[14px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] px-3 py-2 text-sm text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                    value={link.label}
                    onChange={(event) => {
                      const next = [...draft];
                      next[index] = { ...link, label: event.target.value };
                      update(next);
                    }}
                  />
                </label>
                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-[color:var(--mw-text-muted)]">
                  URL
                  <input
                    className="rounded-[14px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] px-3 py-2 text-sm text-[color:var(--mw-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
                    value={link.url}
                    onChange={(event) => {
                      const next = [...draft];
                      next[index] = { ...link, url: event.target.value };
                      update(next);
                    }}
                  />
                </label>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            title="No quick links yet"
            description="Add a shortcut to TradingView, Yahoo Finance, Investing.com, or MarketWatch."
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          onClick={() => {
            const next = [...draft, createDefaultQuickLink(draft.length)].map((item, index) => ({ ...item, order: index }));
            update(next);
          }}
          type="button"
        >
          Add link
        </IconButton>
        <StatusBadge tone="neutral">Saved to local storage</StatusBadge>
      </div>
    </Card>
  );
}
