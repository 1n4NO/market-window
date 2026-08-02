import type { MarketDashboardCardModel } from '../../services/marketDashboard/marketDashboard';
import { MarketCard } from './MarketCard';
import { Card } from '../layout/Card';

export function MarketCardsGrid({
  cards,
  now,
}: {
  cards: MarketDashboardCardModel[];
  now: Date;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Markets</p>
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--mw-text)]">Primary index cards</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[color:var(--mw-text-secondary)]">
            Cards are ordered by your enabled market list. Each card keeps the full surface for index value, session
            hours, freshness, and status so there is no empty mover panel.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <MarketCard key={card.market.id} card={card} now={now} />
          ))}
        </div>
      </div>
    </Card>
  );
}
