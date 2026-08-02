import type { ReactNode } from 'react';
import { classNames } from '../../utils/classNames';

export function Card({
  children,
  className,
  as: Component = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div';
}) {
  return (
    <Component
      className={classNames(
        'rounded-[22px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] shadow-[var(--mw-shadow-card)]',
        'backdrop-blur-0',
        className,
      )}
    >
      {children}
    </Component>
  );
}
