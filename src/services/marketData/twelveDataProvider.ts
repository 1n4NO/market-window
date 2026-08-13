import type { MarketDefinition, MarketQuote } from '../../domain/market';
import {
  createMarketQuote,
  parseNumericValue,
  parseTimestampValue,
  MarketDataError,
  resolveMarketProviderSymbolCandidates,
  type MarketDataProvider,
  type ProviderValidationResult,
} from './marketData';

const TWELVE_DATA_PROVIDER_ID = 'twelvedata';
const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';
const SYMBOL_VALIDATION_TARGET = 'AAPL';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }
  if (typeof body.message === 'string') {
    return body.message;
  }
  if (typeof body.status === 'string' && body.status !== 'ok') {
    return body.status;
  }
  return null;
}

function getErrorCode(body: unknown): number | null {
  if (!isRecord(body)) {
    return null;
  }
  const rawCode = body.code ?? body.status;
  if (typeof rawCode === 'number' && Number.isFinite(rawCode)) {
    return rawCode;
  }
  if (typeof rawCode === 'string') {
    const parsed = Number(rawCode);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isSymbolPlanError(body: unknown): boolean {
  const message = getErrorMessage(body)?.toLowerCase() ?? '';
  return (
    message.includes('symbol is not available') ||
    message.includes('not available with your plan') ||
    message.includes('symbol unavailable') ||
    message.includes('plan does not include')
  );
}

function classifyError(response: Response, body: unknown, context: 'quote' | 'validation' = 'quote'): MarketDataError {
  const message = getErrorMessage(body) ?? response.statusText ?? 'Twelve Data request failed.';
  const code = getErrorCode(body) ?? response.status;

  if (response.status === 403 || code === 403) {
    if (context === 'quote' && isSymbolPlanError(body)) {
      return new MarketDataError('symbol_unavailable', message, response.status);
    }
    return new MarketDataError('invalid_api_key', message, response.status);
  }
  if (response.status === 401 || code === 401) {
    return new MarketDataError('invalid_api_key', message, response.status);
  }
  if (response.status === 429 || code === 429) {
    return new MarketDataError('rate_limited', message, response.status);
  }
  if (response.status === 404 || code === 404) {
    return new MarketDataError('symbol_unavailable', message, response.status);
  }
  if (response.status >= 500 || code >= 500) {
    return new MarketDataError('provider_unavailable', message, response.status);
  }

  return new MarketDataError('unknown_error', message, response.status);
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new MarketDataError('malformed_payload', 'Twelve Data returned an unreadable payload.', response.status);
  }
}

function determineDataState(body: unknown): MarketQuote['dataState'] {
  if (!isRecord(body)) {
    return 'unavailable';
  }
  if (body.is_extended_hours === true) {
    return 'delayed';
  }
  if (body.is_market_open === true) {
    return 'delayed';
  }
  if (parseNumericValue(body.extended_price) !== null || parseNumericValue(body.extended_timestamp) !== null) {
    return 'delayed';
  }
  if (parseNumericValue(body.close) !== null || parseNumericValue(body.previous_close) !== null) {
    return 'end-of-day';
  }
  return 'unavailable';
}

function normalizeIntradaySeries(body: unknown): number[] | null {
  if (!isRecord(body) || !Array.isArray(body.values)) {
    return null;
  }

  const series = body.values
    .map((entry: unknown) => {
      if (!isRecord(entry)) {
        return null;
      }
      return parseNumericValue(entry.close ?? entry.value ?? entry.price);
    })
    .filter((value): value is number => value !== null)
    .reverse();

  return series.length > 1 ? series : null;
}

function normalizeMarketQuote(market: MarketDefinition, symbol: string, body: unknown): MarketQuote {
  if (!isRecord(body)) {
    throw new MarketDataError('malformed_payload', 'Twelve Data response was not an object.');
  }

  const value = parseNumericValue(body.extended_price ?? body.close ?? body.price ?? body.value);
  const previousClose = parseNumericValue(body.previous_close ?? body.previousClose);
  const absoluteChange = parseNumericValue(body.change ?? body.extended_change);
  const percentageChange = parseNumericValue(body.percent_change ?? body.extended_percent_change);
  const currency = typeof body.currency === 'string' ? body.currency : null;
  const asOf =
    parseTimestampValue(body.extended_timestamp ?? body.last_quote_at ?? body.timestamp) ??
    (typeof body.datetime === 'string' ? body.datetime : null);

  if (value === null && previousClose === null) {
    throw new MarketDataError('malformed_payload', 'Twelve Data response did not include a usable quote value.');
  }

  return createMarketQuote({
    marketId: market.id,
    symbol,
    indexName: market.indexName,
    value,
    previousClose,
    absoluteChange,
    percentageChange,
    currency,
    asOf,
    dataState: determineDataState(body),
    provider: TWELVE_DATA_PROVIDER_ID,
  });
}

function isIgnorableSeriesError(error: unknown): boolean {
  return error instanceof MarketDataError && (error.code === 'symbol_unavailable' || error.code === 'malformed_payload');
}

async function fetchTwelveDataJson(apiKey: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${TWELVE_DATA_BASE_URL}/quote`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('apikey', apiKey);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new MarketDataError('offline', 'Network request failed while contacting Twelve Data.');
    }
    throw new MarketDataError('provider_unavailable', 'Failed to contact Twelve Data.');
  }

  const body = await readJsonResponse(response);
  if (!response.ok || (isRecord(body) && body.status === 'error')) {
    throw classifyError(response, body);
  }
  if (isRecord(body) && typeof body.code === 'number' && body.code >= 400) {
    throw classifyError(response, body);
  }

  return body;
}

async function fetchTwelveDataTimeSeriesJson(apiKey: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${TWELVE_DATA_BASE_URL}/time_series`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('apikey', apiKey);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new MarketDataError('offline', 'Network request failed while contacting Twelve Data.');
    }
    throw new MarketDataError('provider_unavailable', 'Failed to contact Twelve Data.');
  }

  const body = await readJsonResponse(response);
  if (!response.ok || (isRecord(body) && body.status === 'error')) {
    throw classifyError(response, body, 'validation');
  }
  if (isRecord(body) && typeof body.code === 'number' && body.code >= 400) {
    throw classifyError(response, body, 'validation');
  }

  return body;
}

export class TwelveDataMarketDataProvider implements MarketDataProvider {
  id = TWELVE_DATA_PROVIDER_ID;

  capabilities = {
    quotes: true,
    historicalSeries: true,
    marketMovers: false,
    moverUniverse: 'unsupported',
  } as const;

  async validateApiKey(apiKey: string): Promise<ProviderValidationResult> {
    if (!apiKey.trim()) {
      return {
        valid: false,
        code: 'invalid_api_key',
        message: 'A Twelve Data API key is required.',
      };
    }

    try {
      await fetchTwelveDataJson(apiKey, { symbol: SYMBOL_VALIDATION_TARGET });
      return {
        valid: true,
        code: 'valid',
        message: 'API key validated successfully.',
      };
    } catch (error) {
      if (error instanceof MarketDataError) {
        return {
          valid: false,
          code: error.code,
          message: error.message,
        };
      }
      return {
        valid: false,
        code: 'unknown_error',
        message: 'Unknown Twelve Data validation failure.',
      };
    }
  }

  async fetchQuote(market: MarketDefinition, apiKey: string): Promise<MarketQuote> {
    const symbolCandidates = resolveMarketProviderSymbolCandidates(market, this.id);
    if (symbolCandidates.length === 0) {
      throw new MarketDataError('symbol_unavailable', `No Twelve Data symbol configured for market "${market.id}".`);
    }

    let lastError: MarketDataError | null = null;
    for (const symbol of symbolCandidates) {
      try {
        const body = await fetchTwelveDataJson(apiKey, {
          symbol,
          prepost: 'true',
        });
        const quote = normalizeMarketQuote(market, symbol, body);

        try {
          const seriesBody = await fetchTwelveDataTimeSeriesJson(apiKey, {
            symbol,
            interval: '5min',
            outputsize: '24',
          });
          const intradaySeries = normalizeIntradaySeries(seriesBody);
          if (intradaySeries && intradaySeries.length > 1) {
            return {
              ...quote,
              intradaySeries,
            };
          }
        } catch (seriesError) {
          if (!isIgnorableSeriesError(seriesError)) {
            throw seriesError;
          }
        }

        return quote;
      } catch (error) {
        if (error instanceof MarketDataError) {
          lastError = error;
          if (error.code === 'symbol_unavailable') {
            continue;
          }
          throw error;
        }
        throw error;
      }
    }

    throw lastError ?? new MarketDataError('symbol_unavailable', `No Twelve Data symbol configured for market "${market.id}".`);
  }
}

export const TWELVE_DATA_MARKET_DATA_PROVIDER = new TwelveDataMarketDataProvider();
