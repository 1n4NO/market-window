import { type MarketMoversPanelModel } from '../../services/marketMovers/marketMovers';
import { MARKET_MOVERS_FEATURE_ENABLED } from '../../config/features';
import { DataStateLabel } from '../feedback/DataStateLabel';
import { ErrorNotice } from '../feedback/ErrorNotice';
import { StatusBadge } from '../feedback/StatusBadge';
import { Card } from '../layout/Card';

export function MarketMoversPanel({ model, enabled = MARKET_MOVERS_FEATURE_ENABLED }: { model: MarketMoversPanelModel | null; enabled?: boolean }) {
  if (!enabled || !model || !model.visible) {
    return null;
  }

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Market movers</p>
          <h3 className="text-lg font-semibold text-[color:var(--mw-text)]">{model.marketLabel}</h3>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StatusBadge tone={model.status === 'ready' ? 'positive' : model.status === 'rate_limited' ? 'warning' : 'neutral'}>
            {model.providerLabel}
          </StatusBadge>
          <StatusBadge tone="neutral">{model.universeLabel ?? 'Universe undisclosed'}</StatusBadge>
        </div>
      </div>

      {model.status === 'ready' ? (
        <div className="grid gap-3 md:grid-cols-3">
          {model.cards.map((card) => (
            <div key={card.kind} className="rounded-[18px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">{card.label}</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--mw-text)]">{card.name}</p>
              <p className="font-mono text-lg tabular-nums text-[color:var(--mw-text)]">{card.symbol}</p>
              <p className="mt-2 font-mono text-2xl tabular-nums text-[color:var(--mw-text)]">{card.valueLabel}</p>
              <p className="mt-2 font-mono text-sm tabular-nums text-[color:var(--mw-text-secondary)]">
                {card.absoluteChangeLabel} | {card.percentageChangeLabel}
              </p>
              <div className="mt-3">
                <DataStateLabel state={card.dataStateLabel} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {model.status === 'stale' ? (
            <ErrorNotice title="Mover data stale" message={model.staleLabel ?? 'Mover data is hidden until it is refreshed.'} />
          ) : null}
          {model.status === 'rate_limited' ? (
            <ErrorNotice title="Mover refresh rate-limited" message={model.rateLimitLabel ?? model.errorLabel ?? 'Refresh limited by the provider.'} />
          ) : null}
        </div>
      )}
    </Card>
  );
}
