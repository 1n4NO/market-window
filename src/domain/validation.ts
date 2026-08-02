import type {
  HolidayDefinition,
  MarketDefinition,
  MarketMoverUniverse,
  ProviderSymbol,
  QuickLink,
  SessionDefinition,
  UserSettings,
  Weekday,
} from './market';
import { WEEKDAYS } from './market';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationSuccess<T> {
  valid: true;
  value: T;
  errors: [];
}

export interface ValidationFailure {
  valid: false;
  errors: ValidationIssue[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function success<T>(value: T): ValidationSuccess<T> {
  return { valid: true, value, errors: [] };
}

function failure(errors: ValidationIssue[]): ValidationFailure {
  return { valid: false, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isTimeString(value: unknown): value is string {
  return isString(value) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isDateString(value: unknown): value is string {
  return isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIanaTimeZone(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isWeekday(value: unknown): value is Weekday {
  return isString(value) && WEEKDAYS.includes(value as Weekday);
}

function uniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateProviderSymbol(value: unknown, path = 'providerSymbols[0]'): ValidationResult<ProviderSymbol> {
  if (!isRecord(value)) {
    return failure([{ path, message: 'Provider symbol must be an object.' }]);
  }

  const errors: ValidationIssue[] = [];
  if (!isNonEmptyString(value.providerId)) {
    errors.push({ path: `${path}.providerId`, message: 'providerId must be a non-empty string.' });
  }
  if (!isNonEmptyString(value.symbol)) {
    errors.push({ path: `${path}.symbol`, message: 'symbol must be a non-empty string.' });
  }
  if ('isDefault' in value && typeof value.isDefault !== 'boolean') {
    errors.push({ path: `${path}.isDefault`, message: 'isDefault must be a boolean when present.' });
  }
  if ('notes' in value && value.notes !== undefined && !isString(value.notes)) {
    errors.push({ path: `${path}.notes`, message: 'notes must be a string when present.' });
  }

  return errors.length > 0 ? failure(errors) : success(value as unknown as ProviderSymbol);
}

export function validateSessionDefinition(
  value: unknown,
  path = 'sessions[0]',
): ValidationResult<SessionDefinition> {
  if (!isRecord(value)) {
    return failure([{ path, message: 'Session definition must be an object.' }]);
  }

  const errors: ValidationIssue[] = [];
  if (!isNonEmptyString(value.id)) {
    errors.push({ path: `${path}.id`, message: 'id must be a non-empty string.' });
  }
  if (!isNonEmptyString(value.label)) {
    errors.push({ path: `${path}.label`, message: 'label must be a non-empty string.' });
  }
  if (!Array.isArray(value.weekdays) || value.weekdays.length === 0) {
    errors.push({ path: `${path}.weekdays`, message: 'weekdays must be a non-empty array.' });
  } else if (!value.weekdays.every(isWeekday)) {
    errors.push({ path: `${path}.weekdays`, message: 'weekdays must only contain valid weekday names.' });
  } else if (!uniqueStrings(value.weekdays)) {
    errors.push({ path: `${path}.weekdays`, message: 'weekdays must not contain duplicates.' });
  }
  if (!isTimeString(value.openTime)) {
    errors.push({ path: `${path}.openTime`, message: 'openTime must use HH:mm format.' });
  }
  if (!isTimeString(value.closeTime)) {
    errors.push({ path: `${path}.closeTime`, message: 'closeTime must use HH:mm format.' });
  }
  if (isTimeString(value.openTime) && isTimeString(value.closeTime) && value.openTime >= value.closeTime) {
    errors.push({
      path: `${path}.openTime`,
      message: 'openTime must be earlier than closeTime for same-day sessions.',
    });
  }
  if ('description' in value && value.description !== undefined && !isString(value.description)) {
    errors.push({ path: `${path}.description`, message: 'description must be a string when present.' });
  }
  if (
    'kind' in value &&
    value.kind !== undefined &&
    !['regular', 'morning', 'afternoon', 'lunch-break'].includes(String(value.kind))
  ) {
    errors.push({
      path: `${path}.kind`,
      message: 'kind must be one of regular, morning, afternoon, or lunch-break.',
    });
  }

  return errors.length > 0 ? failure(errors) : success(value as unknown as SessionDefinition);
}

export function validateMarketDefinition(value: unknown, path = 'markets[0]'): ValidationResult<MarketDefinition> {
  if (!isRecord(value)) {
    return failure([{ path, message: 'Market definition must be an object.' }]);
  }

  const errors: ValidationIssue[] = [];
  for (const key of ['id', 'exchangeCode', 'country', 'indexName', 'timezone', 'colorToken', 'iconId'] as const) {
    if (!isNonEmptyString(value[key])) {
      errors.push({ path: `${path}.${key}`, message: `${key} must be a non-empty string.` });
    }
  }
  if (!isIanaTimeZone(value.timezone)) {
    errors.push({ path: `${path}.timezone`, message: 'timezone must be a valid IANA timezone.' });
  }
  if (!Array.isArray(value.sessions) || value.sessions.length === 0) {
    errors.push({ path: `${path}.sessions`, message: 'sessions must be a non-empty array.' });
  } else {
    const sessionIds = new Set<string>();
    value.sessions.forEach((session, index) => {
      const sessionResult = validateSessionDefinition(session, `${path}.sessions[${index}]`);
      if (!sessionResult.valid) {
        errors.push(...sessionResult.errors);
      } else if (sessionIds.has(sessionResult.value.id)) {
        errors.push({
          path: `${path}.sessions[${index}].id`,
          message: 'session ids must be unique within a market.',
        });
      } else {
        sessionIds.add(sessionResult.value.id);
      }
    });
  }
  if (!Array.isArray(value.providerSymbols) || value.providerSymbols.length === 0) {
    errors.push({ path: `${path}.providerSymbols`, message: 'providerSymbols must be a non-empty array.' });
  } else {
    const providerIds = new Set<string>();
    value.providerSymbols.forEach((symbol, index) => {
      const symbolResult = validateProviderSymbol(symbol, `${path}.providerSymbols[${index}]`);
      if (!symbolResult.valid) {
        errors.push(...symbolResult.errors);
      } else if (providerIds.has(symbolResult.value.providerId)) {
        errors.push({
          path: `${path}.providerSymbols[${index}].providerId`,
          message: 'provider symbols must be unique by providerId.',
        });
      } else {
        providerIds.add(symbolResult.value.providerId);
      }
    });
  }
  if ('holidayCalendarId' in value && value.holidayCalendarId !== undefined && !isString(value.holidayCalendarId)) {
    errors.push({
      path: `${path}.holidayCalendarId`,
      message: 'holidayCalendarId must be a string when present.',
    });
  }
  if ('notes' in value && value.notes !== undefined && !isString(value.notes)) {
    errors.push({ path: `${path}.notes`, message: 'notes must be a string when present.' });
  }
  if ('moverCoverage' in value && value.moverCoverage !== undefined) {
    if (!isRecord(value.moverCoverage)) {
      errors.push({ path: `${path}.moverCoverage`, message: 'moverCoverage must be an object when present.' });
    } else if (
      !Array.isArray(value.moverCoverage.supportedUniverses) ||
      value.moverCoverage.supportedUniverses.length === 0
    ) {
      errors.push({
        path: `${path}.moverCoverage.supportedUniverses`,
        message: 'supportedUniverses must be a non-empty array when moverCoverage is present.',
      });
    } else if (
      !value.moverCoverage.supportedUniverses.every((universe: unknown): universe is MarketMoverUniverse =>
        universe === 'exchange' || universe === 'index-constituents' || universe === 'provider-defined',
      )
    ) {
      errors.push({
        path: `${path}.moverCoverage.supportedUniverses`,
        message: 'supportedUniverses must only include exchange, index-constituents, or provider-defined.',
      });
    }
  }

  return errors.length > 0 ? failure(errors) : success(value as unknown as MarketDefinition);
}

export function validateMarketDefinitions(value: unknown, path = 'markets'): ValidationResult<MarketDefinition[]> {
  if (!Array.isArray(value)) {
    return failure([{ path, message: 'markets must be an array.' }]);
  }

  const errors: ValidationIssue[] = [];
  const marketIds = new Set<string>();

  value.forEach((market, index) => {
    const result = validateMarketDefinition(market, `${path}[${index}]`);
    if (!result.valid) {
      errors.push(...result.errors);
      return;
    }
    if (marketIds.has(result.value.id)) {
      errors.push({ path: `${path}[${index}].id`, message: 'market ids must be unique.' });
      return;
    }
    marketIds.add(result.value.id);
  });

  return errors.length > 0 ? failure(errors) : success(value as MarketDefinition[]);
}

export function validateQuickLink(value: unknown, path = 'quickLinks[0]'): ValidationResult<QuickLink> {
  if (!isRecord(value)) {
    return failure([{ path, message: 'Quick link must be an object.' }]);
  }

  const errors: ValidationIssue[] = [];
  for (const key of ['id', 'label', 'url'] as const) {
    if (!isNonEmptyString(value[key])) {
      errors.push({ path: `${path}.${key}`, message: `${key} must be a non-empty string.` });
    }
  }
  if (typeof value.enabled !== 'boolean') {
    errors.push({ path: `${path}.enabled`, message: 'enabled must be a boolean.' });
  }
  if (!Number.isInteger(value.order)) {
    errors.push({ path: `${path}.order`, message: 'order must be an integer.' });
  }
  if ('iconId' in value && value.iconId !== undefined && !isString(value.iconId)) {
    errors.push({ path: `${path}.iconId`, message: 'iconId must be a string when present.' });
  }

  return errors.length > 0 ? failure(errors) : success(value as unknown as QuickLink);
}

export function validateHolidayDefinition(
  value: unknown,
  path = 'holidays[0]',
): ValidationResult<HolidayDefinition> {
  if (!isRecord(value)) {
    return failure([{ path, message: 'Holiday definition must be an object.' }]);
  }

  const errors: ValidationIssue[] = [];
  for (const key of ['marketId', 'timezone', 'version', 'source'] as const) {
    if (!isNonEmptyString(value[key])) {
      errors.push({ path: `${path}.${key}`, message: `${key} must be a non-empty string.` });
    }
  }
  if (!Array.isArray(value.dates) || value.dates.length === 0) {
    errors.push({ path: `${path}.dates`, message: 'dates must be a non-empty array.' });
  } else if (!value.dates.every(isDateString)) {
    errors.push({ path: `${path}.dates`, message: 'dates must use YYYY-MM-DD format.' });
  }
  if ('notes' in value && value.notes !== undefined && !isString(value.notes)) {
    errors.push({ path: `${path}.notes`, message: 'notes must be a string when present.' });
  }

  return errors.length > 0 ? failure(errors) : success(value as unknown as HolidayDefinition);
}

export function validateUserSettings(value: unknown, path = 'settings'): ValidationResult<UserSettings> {
  if (!isRecord(value)) {
    return failure([{ path, message: 'Settings must be an object.' }]);
  }

  const errors: ValidationIssue[] = [];
  if (!Array.isArray(value.enabledMarketIds) || !value.enabledMarketIds.every(isNonEmptyString)) {
    errors.push({ path: `${path}.enabledMarketIds`, message: 'enabledMarketIds must be an array of strings.' });
  }
  if (!Array.isArray(value.marketOrder) || !value.marketOrder.every(isNonEmptyString)) {
    errors.push({ path: `${path}.marketOrder`, message: 'marketOrder must be an array of strings.' });
  }
  if (!isRecord(value.providerSymbolOverrides)) {
    errors.push({
      path: `${path}.providerSymbolOverrides`,
      message: 'providerSymbolOverrides must be an object.',
    });
  } else {
    for (const [marketId, providerMap] of Object.entries(value.providerSymbolOverrides)) {
      if (!isNonEmptyString(marketId)) {
        errors.push({
          path: `${path}.providerSymbolOverrides`,
          message: 'providerSymbolOverrides keys must be non-empty strings.',
        });
        continue;
      }
      if (!isRecord(providerMap)) {
        errors.push({
          path: `${path}.providerSymbolOverrides.${marketId}`,
          message: 'providerSymbolOverrides entries must be objects.',
        });
        continue;
      }
      for (const [providerId, symbol] of Object.entries(providerMap)) {
        if (!isNonEmptyString(providerId)) {
          errors.push({
            path: `${path}.providerSymbolOverrides.${marketId}`,
            message: 'provider ids must be non-empty strings.',
          });
        }
        if (!isNonEmptyString(symbol)) {
          errors.push({
            path: `${path}.providerSymbolOverrides.${marketId}.${providerId}`,
            message: 'provider symbols must be non-empty strings.',
          });
        }
      }
    }
  }
  if (!Array.isArray(value.quickLinks)) {
    errors.push({ path: `${path}.quickLinks`, message: 'quickLinks must be an array.' });
  } else {
    value.quickLinks.forEach((quickLink, index) => {
      const result = validateQuickLink(quickLink, `${path}.quickLinks[${index}]`);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    });
  }
  if (!isRecord(value.appearance)) {
    errors.push({ path: `${path}.appearance`, message: 'appearance must be an object.' });
  } else {
    if (!['compact', 'comfortable'].includes(String(value.appearance.density))) {
      errors.push({
        path: `${path}.appearance.density`,
        message: 'density must be compact or comfortable.',
      });
    }
    if (!['12h', '24h'].includes(String(value.appearance.clockFormat))) {
      errors.push({
        path: `${path}.appearance.clockFormat`,
        message: 'clockFormat must be 12h or 24h.',
      });
    }
    if (typeof value.appearance.showSearch !== 'boolean') {
      errors.push({
        path: `${path}.appearance.showSearch`,
        message: 'showSearch must be a boolean.',
      });
    }
    if (typeof value.appearance.showQuickLinks !== 'boolean') {
      errors.push({
        path: `${path}.appearance.showQuickLinks`,
        message: 'showQuickLinks must be a boolean.',
      });
    }
  }
  if (!isRecord(value.dataProvider)) {
    errors.push({ path: `${path}.dataProvider`, message: 'dataProvider must be an object.' });
  } else {
    if (!isNonEmptyString(value.dataProvider.providerId)) {
      errors.push({
        path: `${path}.dataProvider.providerId`,
        message: 'providerId must be a non-empty string.',
      });
    }
    if (value.dataProvider.apiKey !== null && value.dataProvider.apiKey !== undefined && !isString(value.dataProvider.apiKey)) {
      errors.push({
        path: `${path}.dataProvider.apiKey`,
        message: 'apiKey must be a string or null.',
      });
    }
  }

  return errors.length > 0 ? failure(errors) : success(value as unknown as UserSettings);
}
