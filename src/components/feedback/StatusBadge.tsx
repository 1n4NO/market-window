import type { ReactNode } from 'react';
import { classNames } from '../../utils/classNames';

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'warning' | 'negative' | 'accent';
}) {
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]',
        tone === 'positive' &&
          'border-[color:var(--mw-positive)]/30 bg-[color:var(--mw-positive)]/10 text-[color:var(--mw-positive)]',
        tone === 'negative' &&
          'border-[color:var(--mw-negative)]/30 bg-[color:var(--mw-negative)]/10 text-[color:var(--mw-negative)]',
        tone === 'warning' &&
          'border-[color:var(--mw-warning)]/30 bg-[color:var(--mw-warning)]/10 text-[color:var(--mw-warning)]',
        tone === 'accent' &&
          'border-[color:var(--mw-market-nse)]/30 bg-[color:var(--mw-market-nse)]/10 text-[color:var(--mw-market-nse)]',
        tone === 'neutral' &&
          'border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] text-[color:var(--mw-text-secondary)]',
      )}
    >
      {children}
    </span>
  );
}
