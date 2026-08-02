export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export const WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type MarketState =
  | 'open'
  | 'closed'
  | 'pre-market'
  | 'lunch-break'
  | 'weekend'
  | 'holiday'
  | 'unknown';

export type DataState =
  | 'live'
  | 'delayed'
  | 'end-of-day'
  | 'cached'
  | 'mock'
  | 'unavailable';

export interface ProviderCapabilities {
  quotes: boolean;
  historicalSeries: boolean;
  marketMovers: boolean;
  moverUniverse: 'exchange' | 'index-constituents' | 'provider-defined' | 'unsupported';
}

export type MarketMoverUniverse = Exclude<ProviderCapabilities['moverUniverse'], 'unsupported'>;

export type MarketMoverKind =
  | 'largest_percentage_gainer'
  | 'largest_percentage_loser'
  | 'largest_absolute_percentage_move';

export interface MarketMoverDefinition {
  kind: MarketMoverKind;
  symbol: string;
  name: string;
  value: number | null;
  previousClose: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  asOf: string | null;
  dataState: DataState;
}

export interface MarketMoversSnapshot {
  marketId: string;
  indexName: string;
  provider: string;
  universe: MarketMoverUniverse;
  dataState: DataState;
  asOf: string | null;
  movers: MarketMoverDefinition[];
}

export interface MarketMoverCoverage {
  supportedUniverses: MarketMoverUniverse[];
}

export interface SessionDefinition {
  id: string;
  label: string;
  weekdays: Weekday[];
  openTime: string;
  closeTime: string;
  description?: string;
  kind?: 'regular' | 'morning' | 'afternoon' | 'lunch-break';
}

export interface ProviderSymbol {
  providerId: string;
  symbol: string;
  isDefault?: boolean;
  notes?: string;
}

export interface MarketDefinition {
  id: string;
  exchangeCode: string;
  country: string;
  indexName: string;
  timezone: string;
  colorToken: string;
  iconId: string;
  sessions: SessionDefinition[];
  providerSymbols: ProviderSymbol[];
  holidayCalendarId?: string;
  moverCoverage?: MarketMoverCoverage;
  notes?: string;
}

export interface MarketClockState {
  state: MarketState;
  nextTransitionAt: string | null;
  previousTransitionAt: string | null;
  millisecondsUntilTransition: number | null;
  activeSession: SessionDefinition | null;
  nextSession: SessionDefinition | null;
  nextAction: string | null;
  holidayConfidence: 'confirmed' | 'unknown';
}

export interface MarketQuote {
  marketId: string;
  symbol: string;
  indexName: string;
  value: number | null;
  previousClose: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  intradaySeries?: number[] | null;
  currency: string | null;
  asOf: string | null;
  dataState: DataState;
  provider: string;
}

export interface QuickLink {
  id: string;
  label: string;
  url: string;
  iconId?: string;
  enabled: boolean;
  order: number;
}

export interface UserSettings {
  enabledMarketIds: string[];
  marketOrder: string[];
  quickLinks: QuickLink[];
  providerSymbolOverrides: Record<string, Record<string, string>>;
  appearance: {
    density: 'compact' | 'comfortable';
    clockFormat: '12h' | '24h';
    showSearch: boolean;
    showQuickLinks: boolean;
  };
  dataProvider: {
    providerId: string;
    apiKey: string | null;
  };
}

export interface HolidayDefinition {
  marketId: string;
  timezone: string;
  version: string;
  source: string;
  dates: string[];
  notes?: string;
}
