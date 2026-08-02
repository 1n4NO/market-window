import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the developer view and all bundled markets', () => {
    render(<App />);

    expect(screen.getByText('Clock engine developer view')).toBeInTheDocument();
    expect(screen.getByText('NSE')).toBeInTheDocument();
    expect(screen.getByText('TSE')).toBeInTheDocument();
    expect(screen.getByText('LSE')).toBeInTheDocument();
    expect(screen.getByText('NYSE')).toBeInTheDocument();
    expect(screen.getByText('HKEX')).toBeInTheDocument();
    expect(screen.getByText('Xetra')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(6);
  });
});
