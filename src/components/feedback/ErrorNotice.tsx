import { AlertTriangle } from 'lucide-react';
import { classNames } from '../../utils/classNames';

export function ErrorNotice({
  title,
  message,
  className,
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        'flex items-start gap-3 rounded-[22px] border border-[color:var(--mw-negative)]/30 bg-[color:var(--mw-negative)]/8 p-4 text-sm',
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--mw-negative)]" />
      <div className="space-y-1">
        <p className="font-medium text-[color:var(--mw-text)]">{title}</p>
        <p className="leading-6 text-[color:var(--mw-text-secondary)]">{message}</p>
      </div>
    </div>
  );
}
