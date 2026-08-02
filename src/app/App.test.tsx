import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('renders the new-tab shell with header, search, and placeholder content', () => {
    render(<App />);

    expect(screen.getByText('A calm market-hours dashboard for your new tab.')).toBeInTheDocument();
    expect(screen.getByText('Market cards and timeline are next.')).toBeInTheDocument();
    expect(screen.getByLabelText('Search the web or enter a URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Markets' })).toBeInTheDocument();
    expect(screen.getByText('Nothing to render yet')).toBeInTheDocument();
    expect(screen.getByText('Quick links')).toBeInTheDocument();
  });

  it('focuses the search field when the slash shortcut is pressed', () => {
    render(<App />);

    const search = screen.getByLabelText('Search the web or enter a URL');
    expect(search).not.toHaveFocus();

    fireEvent.keyDown(window, { key: '/', code: 'Slash' });

    expect(search).toHaveFocus();
  });
});
