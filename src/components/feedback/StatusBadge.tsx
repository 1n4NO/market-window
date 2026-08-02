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
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]',
        tone === 'positive' &&
          'border-[color:var(--mw-positive)]/30 bg-[color:var(--mw-positive)]/10 text-[color:var(--mw-positive)]',
        tone === 'negative' &&
          'border-[color:var(--mw-negative)]/30 bg-[color:var(--mw-negative)]/10 text-[color:var(--mw-negative)]',
        tone === 'warning' &&
          'border-[color:var(--mw-warning)]/30 bg-[color:var(--mw-warning)]/10 text-[color:var(--mw-warning)]',
        tone === 'accent' &&
          'border-[color:var(--mw-state-pre-market)]/50 bg-[color:var(--mw-state-pre-market)]/20 text-[color:#6ea8ff]',
        tone === 'neutral' &&
          'border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] text-[color:var(--mw-text-secondary)]',
      )}
    >
      {children}
    </span>
  );
}
