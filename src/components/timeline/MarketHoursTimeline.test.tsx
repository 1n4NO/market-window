import { render, screen } from '@testing-library/react';
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

    const sessionButton = screen.getByRole('button', {
      name: /Mumbai \(NSE\) 09:15–15:30 IST.*Your time:/i,
    });
    sessionButton.focus();
    expect(sessionButton).toHaveFocus();
    expect(screen.getByText('MARKET HOURS (LOCAL TIME)')).toBeInTheDocument();
  });

  it('shows a muted weekend projection instead of empty lanes', () => {
    const nse = market('nse');

    render(
      <MarketHoursTimeline
        marketStates={{
          nse: createClockState('weekend', nse, 'Opens Monday at 09:15'),
        }}
        markets={[nse]}
        now={new Date('2026-08-02T09:00:00.000Z')}
        viewerTimeZone="Asia/Kolkata"
      />,
    );

    expect(screen.getByText('Weekend projection')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /projection/i })).toBeInTheDocument();
  });
});
