import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MARKET_DEFINITIONS } from '../../config/markets';
import type { MarketClockState, MarketDefinition } from '../../domain/market';
import { MarketHoursTimeline } from './MarketHoursTimeline';

function market(id: string): MarketDefinition {
  const definition = MARKET_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) {
    throw new Error(`Missing market definition: ${id}`);
  }
  return definition;
}

function createClockState(
  state: MarketClockState['state'],
  marketDefinition: MarketDefinition,
  nextAction: string,
): MarketClockState {
  return {
    state,
    nextTransitionAt: '2026-08-03T12:00:00.000Z',
    previousTransitionAt: '2026-08-03T08:00:00.000Z',
    millisecondsUntilTransition: 3600000,
    activeSession: marketDefinition.sessions[0] ?? null,
    nextSession: marketDefinition.sessions[0] ?? null,
    nextAction,
    holidayConfidence: 'confirmed',
  };
}

describe('MarketHoursTimeline', () => {
  it('supports keyboard access to session bars', async () => {
    const user = userEvent.setup();
    const nse = market('nse');

    render(
      <MarketHoursTimeline
        marketStates={{
          nse: createClockState('open', nse, 'Closes in 45m'),
        }}
        markets={[nse]}
        now={new Date('2026-08-03T09:00:00.000Z')}
        viewerTimeZone="Asia/Kolkata"
      />,
    );

    await user.tab();
    await user.tab();

    const sessionButton = screen.getByRole('button', {
      name: /NSE, Regular session, 09:15 to 15:30/i,
    });
    expect(sessionButton).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'NSE Regular session' })).toBeInTheDocument();
  });
});
