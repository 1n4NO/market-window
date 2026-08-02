import { X } from 'lucide-react';
import { useEffect } from 'react';
import { IconButton } from '../layout/IconButton';
import { DeveloperSettingsPanel } from './DeveloperSettingsPanel';

export function SettingsDrawer({
  open,
  initialSection = 'markets',
  onClose,
}: {
  open: boolean;
  initialSection?: 'markets' | 'appearance' | 'provider' | 'data';
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-3 sm:p-5" role="presentation">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        aria-modal="true"
        className="relative z-10 flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-[color:var(--mw-border)] bg-[color:var(--mw-page)] shadow-[var(--mw-shadow-card)]"
        role="dialog"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-[color:var(--mw-border)] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mw-text-muted)]">Settings</p>
            <h2 className="text-lg font-semibold text-[color:var(--mw-text)]">
              {initialSection === 'markets'
                ? 'Markets and preferences'
                : initialSection === 'appearance'
                  ? 'Appearance'
                  : initialSection === 'provider'
                    ? 'Data provider'
                    : 'Data management'}
            </h2>
          </div>
          <IconButton aria-label="Close settings" onClick={onClose} tone="subtle" type="button">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <DeveloperSettingsPanel title="Settings" subtitle="Manage your markets, provider, appearance, and local data." />
        </div>
      </div>
    </div>
  );
}
