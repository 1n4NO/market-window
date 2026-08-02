import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the developer view and all bundled markets', () => {
    render(<App />);

    expect(screen.getByText('Clock engine developer view')).toBeInTheDocument();
    expect(screen.getAllByText('NSE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TSE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('LSE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NYSE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HKEX').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Xetra').length).toBeGreaterThan(0);
    expect(screen.getByText('Persistence test bench')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(6);
  });
});
