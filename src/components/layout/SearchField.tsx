import { forwardRef, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { IconButton } from './IconButton';
import { Card } from './Card';
import { classNames } from '../../utils/classNames';
import { toSearchDestination } from '../../utils/search';

export const SearchField = forwardRef<
  HTMLInputElement,
  {
    onNavigate?: (destination: string) => void;
    compact?: boolean;
    className?: string;
  }
>(function SearchField({ onNavigate, compact = false, className }, ref) {
  const id = useId();
  const [value, setValue] = useState('');

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const destination = toSearchDestination(value);
    if (onNavigate) {
      onNavigate(destination);
      return;
    }
    window.location.assign(destination);
  }

  return (
    <Card className={classNames('p-3 sm:p-4', className)}>
      <form className="flex items-center gap-3" onSubmit={submitSearch}>
        <label className="sr-only" htmlFor={id}>
          Search the web or enter a URL
        </label>
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--mw-border)] bg-[color:var(--mw-panel-raised)] text-[color:var(--mw-text-secondary)]">
          <Search className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            ref={ref}
            id={id}
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
            placeholder="Search the web or type a site address"
            className={classNames(
              'h-12 w-full rounded-none border-0 bg-transparent text-base text-[color:var(--mw-text)] outline-none placeholder:text-[color:var(--mw-text-muted)]',
              'font-mono tabular-nums sm:font-sans sm:tabular-nums',
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          {value ? (
            <IconButton
              type="button"
              tone="subtle"
              aria-label="Clear search"
              onClick={() => {
                setValue('');
              }}
            >
              <X className="h-4 w-4" />
            </IconButton>
          ) : null}
          <IconButton type="submit" aria-label="Submit search">
            <span className={compact ? 'hidden sm:inline' : 'inline'}>Go</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </form>
    </Card>
  );
});
