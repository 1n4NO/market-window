import type { MarketClockState } from '../../domain/market';
import { SettingsDrawer } from './SettingsDrawer';

const EDIT_MARKETS_SECTIONS = ['markets'] as const;

export function EditMarketsDrawer({
  open,
  onClose,
  marketStates,
  now,
}: {
  open: boolean;
  onClose: () => void;
  marketStates: Record<string, MarketClockState>;
  now: Date;
}) {
  return (
    <SettingsDrawer
      availableSections={EDIT_MARKETS_SECTIONS}
      description="Enable markets, reorder them, and manage provider symbols."
      initialSection="markets"
      marketStates={marketStates}
      now={now}
      onClose={onClose}
      open={open}
      title="Edit Markets"
    />
  );
}
