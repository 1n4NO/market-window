import type { ReactNode } from 'react';
import { classNames } from '../../utils/classNames';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        'flex flex-col gap-4 rounded-[22px] border border-dashed border-[color:var(--mw-border)] bg-[color:var(--mw-panel-inset)] p-6',
        className,
      )}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[color:var(--mw-text)]">{title}</p>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--mw-text-secondary)]">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
