import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '../../utils/classNames';

export function IconButton({
  className,
  children,
  tone = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: 'default' | 'subtle';
}) {
  return (
    <button
      className={classNames(
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mw-page)]',
        tone === 'default'
          ? 'border-[color:var(--mw-border)] bg-[color:var(--mw-panel-raised)] text-[color:var(--mw-text)] hover:border-[color:var(--mw-border-strong)]'
          : 'border-transparent bg-transparent text-[color:var(--mw-text-secondary)] hover:bg-white/5 hover:text-[color:var(--mw-text)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
