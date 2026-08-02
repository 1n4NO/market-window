import type { CSSProperties } from 'react';

export const surfaceTokens = {
  page: 'var(--mw-page)',
  pageGlow: 'var(--mw-page-glow)',
  panel: 'var(--mw-panel)',
  panelRaised: 'var(--mw-panel-raised)',
  inset: 'var(--mw-panel-inset)',
} as const;

export const borderTokens = {
  subtle: 'var(--mw-border)',
  strong: 'var(--mw-border-strong)',
  focus: 'var(--mw-focus)',
} as const;

export const textTokens = {
  primary: 'var(--mw-text)',
  secondary: 'var(--mw-text-secondary)',
  muted: 'var(--mw-text-muted)',
} as const;

export const semanticTokens = {
  positive: 'var(--mw-positive)',
  negative: 'var(--mw-negative)',
  warning: 'var(--mw-warning)',
} as const;

export const marketStateBadgeTokens = {
  open: 'var(--mw-state-open)',
  closed: 'var(--mw-state-closed)',
  'pre-market': 'var(--mw-state-pre-market)',
  'lunch-break': 'var(--mw-state-lunch-break)',
  weekend: 'var(--mw-state-weekend)',
  holiday: 'var(--mw-state-holiday)',
  unknown: 'var(--mw-state-unknown)',
} as const;

export const radiusTokens = {
  card: 'var(--mw-radius-card)',
  pill: 'var(--mw-radius-pill)',
  field: 'var(--mw-radius-field)',
} as const;

export const spacingTokens = {
  pageX: 'var(--mw-space-page-x)',
  pageY: 'var(--mw-space-page-y)',
  section: 'var(--mw-space-section)',
  card: 'var(--mw-space-card)',
} as const;

export const shadowTokens = {
  card: 'var(--mw-shadow-card)',
  lift: 'var(--mw-shadow-lift)',
  inset: 'var(--mw-shadow-inset)',
} as const;

export const marketColorTokens = {
  nse: 'var(--mw-market-nse)',
  tse: 'var(--mw-market-tse)',
  lse: 'var(--mw-market-lse)',
  nyse: 'var(--mw-market-nyse)',
  hkex: 'var(--mw-market-hkex)',
  xetra: 'var(--mw-market-xetra)',
} as const;

type MarketAccentStyle = CSSProperties & {
  '--mw-market-accent': string;
};

export function getMarketColorStyle(marketId: keyof typeof marketColorTokens | string): MarketAccentStyle {
  const token = (marketColorTokens as Record<string, string>)[marketId] ?? 'var(--mw-accent)';
  return {
    '--mw-market-accent': token,
  };
}

export function getStateToken(state: keyof typeof marketStateBadgeTokens | string): string {
  return (marketStateBadgeTokens as Record<string, string>)[state] ?? marketStateBadgeTokens.unknown;
}
