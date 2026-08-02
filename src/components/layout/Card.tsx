import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../../utils/classNames';

export function Card({
  children,
  className,
  as: Component = 'section',
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div';
} & HTMLAttributes<HTMLElement>) {
  return (
    <Component
      className={classNames(
        'rounded-[14px] border border-[color:var(--mw-border)] bg-[color:var(--mw-panel)] shadow-[var(--mw-shadow-card)]',
        'backdrop-blur-0',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
