import { afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  const originalOnLine = navigator.onLine;

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: originalOnLine,
    });
  });

  it('renders the finished dashboard shell', () => {
    render(<App />);

    expect(screen.getByText('Primary index cards')).toBeInTheDocument();
    expect(screen.getByText('Your search bar, front and center')).toBeInTheDocument();
    expect(screen.getByLabelText('Search the web or enter a URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Markets' })).toBeInTheDocument();
    expect(screen.getByText('Editable shortcuts')).toBeInTheDocument();
  });

  it('focuses the search field when the slash shortcut is pressed', () => {
    render(<App />);

    const search = screen.getByLabelText('Search the web or enter a URL');
    expect(search).not.toHaveFocus();

    fireEvent.keyDown(window, { key: '/', code: 'Slash' });

    expect(search).toHaveFocus();
  });

  it('shows offline status without hiding the dashboard shell', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    render(<App />);

    expect(screen.getAllByText('Offline').length).toBeGreaterThan(0);
    expect(screen.getByText('Primary index cards')).toBeInTheDocument();
    expect(screen.getByText('Your search bar, front and center')).toBeInTheDocument();
  });
});
