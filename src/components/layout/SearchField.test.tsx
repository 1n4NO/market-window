import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('navigates directly when the input is a URL', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<SearchField onNavigate={onNavigate} />);

    await user.type(screen.getByLabelText('Search the web or enter a URL'), 'example.com{enter}');

    expect(onNavigate).toHaveBeenCalledWith('https://example.com');
  });

  it('builds a Google search when the input is plain text', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<SearchField onNavigate={onNavigate} />);

    await user.type(screen.getByLabelText('Search the web or enter a URL'), 'global markets{enter}');

    expect(onNavigate).toHaveBeenCalledWith('https://www.google.com/search?q=global%20markets');
  });
});
