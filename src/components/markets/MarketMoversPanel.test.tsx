import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MarketMoversPanelModel } from '../../services/marketMovers/marketMovers';
import { MarketMoversPanel } from './MarketMoversPanel';

function createReadyModel(): MarketMoversPanelModel {
  return {
    visible: true,
    status: 'ready',
    universeLabel: 'Exchange-wide movers',
    marketLabel: 'NSE movers',
    providerLabel: 'movers-demo',
    cacheAgeLabel: 'Cached 2 hours ago',
    staleLabel: null,
    rateLimitLabel: null,
    errorLabel: null,
    cards: [
      {
        kind: 'largest_percentage_gainer',
        label: 'Largest percentage gainer',
        symbol: 'AAA',
        name: 'Alpha',
        valueLabel: '101',
        absoluteChangeLabel: '+6',
        percentageChangeLabel: '+6.32%',
        tone: 'positive',
        dataStateLabel: 'delayed',
      },
      {
        kind: 'largest_percentage_loser',
        label: 'Largest percentage loser',
        symbol: 'BBB',
        name: 'Beta',
        valueLabel: '90',
        absoluteChangeLabel: '−10',
        percentageChangeLabel: '−10.00%',
        tone: 'negative',
        dataStateLabel: 'delayed',
      },
      {
        kind: 'largest_absolute_percentage_move',
        label: 'Largest absolute percentage move',
        symbol: 'CCC',
        name: 'Gamma',
        valueLabel: '120',
        absoluteChangeLabel: '+20',
        percentageChangeLabel: '+20.00%',
        tone: 'positive',
        dataStateLabel: 'delayed',
      },
    ],
  };
}

describe('MarketMoversPanel', () => {
  it('renders supported movers when enabled', () => {
    render(<MarketMoversPanel enabled model={createReadyModel()} />);

    expect(screen.getByText('Market movers')).toBeInTheDocument();
    expect(screen.getByText('Exchange-wide movers')).toBeInTheDocument();
    expect(screen.getByText('Largest percentage gainer')).toBeInTheDocument();
    expect(screen.getByText('Largest percentage loser')).toBeInTheDocument();
    expect(screen.getByText('Largest absolute percentage move')).toBeInTheDocument();
  });

  it('hides the feature when disabled or unsupported', () => {
    const { rerender } = render(<MarketMoversPanel enabled={false} model={createReadyModel()} />);
    expect(screen.queryByText('Market movers')).not.toBeInTheDocument();

    rerender(<MarketMoversPanel enabled model={null} />);
    expect(screen.queryByText('Market movers')).not.toBeInTheDocument();
  });

  it('shows stale and rate-limited notices without empty cards', () => {
    render(
      <MarketMoversPanel
        enabled
        model={{
          ...createReadyModel(),
          status: 'stale',
          cards: [],
          staleLabel: 'Mover data is stale and hidden until a fresh response arrives.',
        }}
      />,
    );

    expect(screen.getByText('Mover data stale')).toBeInTheDocument();
    expect(screen.queryByText('Largest percentage gainer')).not.toBeInTheDocument();
  });
});
