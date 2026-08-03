import { afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

    expect(screen.getByText('MARKET HOURS (LOCAL TIME)')).toBeInTheDocument();
    expect(screen.getByLabelText('Search the web or enter a URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Markets' })).toBeInTheDocument();
    expect(screen.getByText('QUICK LINKS')).toBeInTheDocument();
    expect(screen.getByText('MARKET SUMMARY')).toBeInTheDocument();
    expect(screen.getByText('UPCOMING OPENS')).toBeInTheDocument();
    expect(screen.getByText('All times are local to the exchange')).toBeInTheDocument();
    expect(screen.getByText('Free/demo')).toBeInTheDocument();
  });

  it('shows deterministic demo values when live data is unavailable', async () => {
    render(<App />);

    expect(await screen.findByText('24,682.35', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getAllByText('DEMO').length).toBeGreaterThan(0);
  });

  it('opens settings without crashing', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('opens edit markets without crashing', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Edit Markets' }));
    expect(await screen.findByRole('dialog', { name: 'Edit Markets' })).toBeInTheDocument();
  });

  it('focuses the search field when the slash shortcut is pressed', () => {
    render(<App />);

    const search = screen.getByLabelText('Search the web or enter a URL');
    expect(search).not.toHaveFocus();

    fireEvent.keyDown(window, { key: '/', code: 'Slash' });

    expect(search).toHaveFocus();
  });

  it('keeps the dashboard shell visible when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    render(<App />);

    expect(screen.getByText('MARKET HOURS (LOCAL TIME)')).toBeInTheDocument();
    expect(screen.getByText('QUICK LINKS')).toBeInTheDocument();
    expect(screen.getByText('All times are local to the exchange')).toBeInTheDocument();
  });
});
