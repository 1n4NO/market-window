import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { QuickLink } from '../../domain/market';
import type { MarketSummaryModel } from '../../services/marketDashboard/marketDashboard';
import { MarketSummaryPanel, QuickLinksPanel } from './DashboardPanels';

function createSummary(): MarketSummaryModel {
  return {
    open: 2,
    closed: 3,
    onBreak: 1,
    openingWithinThreeHours: 1,
    total: 6,
    closedPercentage: 50,
  };
}

describe('MarketSummaryPanel', () => {
  it('renders a compact summary with one donut and four inline metrics', () => {
    render(<MarketSummaryPanel summary={createSummary()} />);

    expect(screen.getByText('MARKET SUMMARY')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('Opens Soon')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByLabelText('Closed markets represent 50% of enabled markets')).toBeInTheDocument();
    expect(screen.getByText('50% of tracked markets are closed.')).toBeInTheDocument();
    expect(screen.getByText('3 of 6 markets')).toBeInTheDocument();
    expect(screen.getByText('Next open: Tokyo (TSE)')).toBeInTheDocument();
  });
});

function createQuickLinks(): QuickLink[] {
  return [
    {
      id: 'investing',
      label: 'Investing.com',
      url: 'https://www.investing.com',
      enabled: true,
      order: 0,
    },
    {
      id: 'tradingview',
      label: 'TradingView',
      url: 'https://www.tradingview.com',
      enabled: true,
      order: 1,
    },
    {
      id: 'marketwatch',
      label: 'MarketWatch',
      url: 'https://www.marketwatch.com',
      enabled: true,
      order: 2,
    },
    {
      id: 'yahoo',
      label: 'Yahoo Finance',
      url: 'https://finance.yahoo.com',
      enabled: true,
      order: 3,
    },
  ];
}

describe('QuickLinksPanel', () => {
  it('renders a compact read-only shortcut grid with no inline editing controls', () => {
    render(<QuickLinksPanel quickLinks={createQuickLinks()} visible />);

    expect(screen.getByText('QUICK LINKS')).toBeInTheDocument();
    expect(screen.getByText('Investing.com')).toBeInTheDocument();
    expect(screen.getByText('TradingView')).toBeInTheDocument();
    expect(screen.getByText('MarketWatch')).toBeInTheDocument();
    expect(screen.getByText('Yahoo Finance')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Select any market card to view today's session details\./i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
