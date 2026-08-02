import { forwardRef, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { classNames } from '../../utils/classNames';
import { toSearchDestination } from '../../utils/search';

export const SearchField = forwardRef<
  HTMLInputElement,
  {
    onNavigate?: (destination: string) => void;
    className?: string;
  }
>(function SearchField({ onNavigate, className }, ref) {
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
    <form className={classNames('w-full', className)} onSubmit={submitSearch}>
      <label className="sr-only" htmlFor={id}>
        Search the web or enter a URL
      </label>
      <div className="flex h-[46px] items-center gap-2 rounded-[12px] border border-[color:rgba(147,166,197,0.12)] bg-[color:var(--mw-panel-raised)] px-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <Search className="h-4 w-4 shrink-0 text-[color:var(--mw-text-muted)]" aria-hidden="true" />
        <input
          ref={ref}
          id={id}
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          placeholder="Search Google or type a URL"
          className={classNames(
            'min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[color:var(--mw-text)] outline-none placeholder:text-[color:var(--mw-text-muted)]',
            'tabular-nums',
          )}
        />
        <div className="flex items-center gap-2">
          {value ? (
            <button
              aria-label="Clear search"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--mw-text-muted)] transition hover:bg-white/5 hover:text-[color:var(--mw-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mw-focus)]"
              type="button"
              onClick={() => {
                setValue('');
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[color:rgba(78,163,255,0.45)]" />
          )}
        </div>
      </div>
    </form>
  );
});
