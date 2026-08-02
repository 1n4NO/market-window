import type { MarketDashboardCardModel } from '../../services/marketDashboard/marketDashboard';
import { MarketCard } from './MarketCard';

export function MarketCardsGrid({
  cards,
  now,
}: {
  cards: MarketDashboardCardModel[];
  now: Date;
}) {
  return (
    <div className="grid items-stretch gap-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <MarketCard key={card.market.id} card={card} now={now} />
      ))}
    </div>
  );
}
