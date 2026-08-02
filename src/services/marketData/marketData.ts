import type {
  MarketDefinition,
  MarketMoversSnapshot,
  MarketQuote,
  ProviderCapabilities,
  ProviderSymbol,
} from '../../domain/market';

export type ProviderValidationCode =
  | 'valid'
  | 'invalid_api_key'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'offline'
  | 'symbol_unavailable'
  | 'malformed_payload'
  | 'unknown_error';

export interface ProviderValidationResult {
  valid: boolean;
  code: ProviderValidationCode;
  message: string | null;
}

export interface MarketDataProvider {
  id: string;
  capabilities: ProviderCapabilities;
  validateApiKey(apiKey: string): Promise<ProviderValidationResult>;
  fetchQuote(market: MarketDefinition, apiKey: string): Promise<MarketQuote>;
  fetchMovers?(market: MarketDefinition, apiKey: string): Promise<MarketMoversSnapshot>;
}

export type ProviderSymbolOverrideMap = Record<string, Record<string, string>>;

export type MarketDataErrorCode =
  | 'invalid_api_key'
  | 'rate_limited'
  | 'symbol_unavailable'
  | 'provider_unavailable'
  | 'offline'
  | 'malformed_payload'
  | 'unknown_error';

export class MarketDataError extends Error {
  constructor(
    public readonly code: MarketDataErrorCode,
    message: string,
    public readonly statusCode: number | null = null,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseTimestampValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

export function computeChangeFields(input: {
  value: number | null;
  previousClose: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
}): Pick<MarketQuote, 'absoluteChange' | 'percentageChange'> {
  const absoluteChange =
    input.absoluteChange ??
    (input.value !== null && input.previousClose !== null ? input.value - input.previousClose : null);

  const percentageChange =
    input.percentageChange ??
    (absoluteChange !== null && input.previousClose !== null && input.previousClose !== 0
      ? (absoluteChange / input.previousClose) * 100
      : null);

  return {
    absoluteChange,
    percentageChange,
  };
}

export function createMarketQuote(input: {
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
  dataState: MarketQuote['dataState'];
  provider: string;
}): MarketQuote {
  const change = computeChangeFields(input);
  return {
    marketId: input.marketId,
    symbol: input.symbol,
    indexName: input.indexName,
    value: input.value,
    previousClose: input.previousClose,
    absoluteChange: change.absoluteChange,
    percentageChange: change.percentageChange,
    dayHigh: input.dayHigh ?? null,
    dayLow: input.dayLow ?? null,
    intradaySeries: input.intradaySeries ?? null,
    currency: input.currency,
    asOf: input.asOf,
    dataState: input.dataState,
    provider: input.provider,
  };
}

export function resolveMarketProviderSymbol(
  market: MarketDefinition,
  providerId: string,
  overrides?: ProviderSymbolOverrideMap,
): string | null {
  const override = overrides?.[market.id]?.[providerId];
  if (isNonEmptyString(override)) {
    return override.trim();
  }

  const providerSymbol = market.providerSymbols.find((candidate) => candidate.providerId === providerId && candidate.isDefault)
    ?? market.providerSymbols.find((candidate) => candidate.providerId === providerId);
  return providerSymbol?.symbol ?? null;
}

export function withProviderSymbolOverride(
  market: MarketDefinition,
  providerId: string,
  symbol: string,
): MarketDefinition {
  const filtered = market.providerSymbols.filter((candidate) => candidate.providerId !== providerId);
  const matching = market.providerSymbols.find((candidate) => candidate.providerId === providerId);

  const override: ProviderSymbol = {
    providerId,
    symbol,
    isDefault: true,
    notes: matching?.notes,
  };

  return {
    ...market,
    providerSymbols: [override, ...filtered],
  };
}

export function isResponseRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}
