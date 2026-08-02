import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the shell copy', () => {
    render(<App />);

    expect(screen.getByText('Market Window')).toBeInTheDocument();
    expect(screen.getByText('Temporary dashboard placeholder')).toBeInTheDocument();
  });
});
