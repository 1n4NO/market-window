export interface MockQuoteFixture {
  value: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  currency: string;
  asOf: string;
  intradaySeries: number[];
}

interface DemoSeriesProfile {
  seed: string;
  trendBias: number;
  volatility: number;
  swing: number;
  driftCurve: number;
  oscillation: number;
  secondaryOscillation: number;
  spikeCount: number;
  spikeStrength: number;
  spikeWidth: number;
  startGap: number;
  endBias: number;
}

interface BaseFixtureInput {
  marketId: string;
  value: number;
  previousClose: number;
  currency: string;
  asOf: string;
  profile: DemoSeriesProfile;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function createSeededRandom(seed: string): () => number {
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(31, state) + seed.charCodeAt(index);
    state |= 0;
  }

  if (state === 0) {
    state = 0x6d2b79f5;
  }

  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createSpikePositions(profile: DemoSeriesProfile): number[] {
  const random = createSeededRandom(`${profile.seed}:spikes`);
  const positions = new Set<number>();
  while (positions.size < profile.spikeCount) {
    const candidate = 0.18 + random() * 0.64;
    positions.add(Number(candidate.toFixed(3)));
  }
  return Array.from(positions.values()).sort((left, right) => left - right);
}

function createDemoSeries(input: BaseFixtureInput): number[] {
  const random = createSeededRandom(`${input.profile.seed}:intraday`);
  const spikePositions = createSpikePositions(input.profile);
  const count = 48;
  const openingGap = (random() - 0.5) * input.profile.startGap;
  const openingValue = input.previousClose + openingGap;
  const targetClose = input.value;
  const drift = targetClose - openingValue;

  const series = Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    const envelope = Math.sin(Math.PI * progress);
    const progressCurve = Math.pow(progress, input.profile.driftCurve);
    const baseLine = openingValue + drift * progressCurve;

    const primaryWave =
      Math.sin(progress * Math.PI * input.profile.oscillation + input.profile.trendBias) *
      input.profile.volatility *
      input.profile.swing *
      envelope;
    const secondaryWave =
      Math.sin(progress * Math.PI * input.profile.secondaryOscillation + input.profile.trendBias * 0.5) *
      (input.profile.volatility * 0.45 * input.profile.swing) *
      Math.pow(envelope, 1.25);
    const microNoise = (random() - 0.5) * input.profile.volatility * 0.14 * envelope;

    const spikes = spikePositions.reduce((accumulator, position, spikeIndex) => {
      const width = input.profile.spikeWidth;
      const distance = Math.abs(progress - position);
      if (distance > width * 2) {
        return accumulator;
      }
      const spikeEnvelope = Math.exp(-Math.pow(distance / width, 2));
      const spikeDirection = spikeIndex % 2 === 0 ? 1 : -1;
      return accumulator + input.profile.spikeStrength * spikeDirection * spikeEnvelope * envelope;
    }, 0);

    const pullback = Math.sin(progress * Math.PI * 3 + input.profile.trendBias * 0.25) * input.profile.volatility * 0.09 * envelope;
    const value = baseLine + primaryWave + secondaryWave + microNoise + spikes + pullback;
    return roundTo2(value);
  });

  series[0] = roundTo2(openingValue);
  series[series.length - 1] = roundTo2(targetClose);

  return series;
}

function createFixture(input: BaseFixtureInput): MockQuoteFixture {
  const intradaySeries = createDemoSeries(input);
  const dayHigh = roundTo2(Math.max(...intradaySeries, input.value));
  const dayLow = roundTo2(Math.min(...intradaySeries, input.value));

  return {
    value: roundTo2(input.value),
    previousClose: roundTo2(input.previousClose),
    dayHigh,
    dayLow,
    currency: input.currency,
    asOf: input.asOf,
    intradaySeries,
  };
}

export const MOCK_QUOTE_FIXTURES: Record<string, MockQuoteFixture> = {
  nse: createFixture({
    marketId: 'nse',
    value: 24682.35,
    previousClose: 24590.12,
    currency: 'INR',
    asOf: '2026-07-31T15:30:00+05:30',
    profile: {
      seed: 'nse',
      trendBias: 0.35,
      volatility: 15.2,
      swing: 0.9,
      driftCurve: 1.12,
      oscillation: 2.8,
      secondaryOscillation: 6.5,
      spikeCount: 2,
      spikeStrength: 16,
      spikeWidth: 0.04,
      startGap: 38,
      endBias: 0.25,
    },
  }),
  tse: createFixture({
    marketId: 'tse',
    value: 41250.19,
    previousClose: 41098.33,
    currency: 'JPY',
    asOf: '2026-07-31T15:30:00+09:00',
    profile: {
      seed: 'tse',
      trendBias: -0.15,
      volatility: 42,
      swing: 1.2,
      driftCurve: 0.95,
      oscillation: 3.5,
      secondaryOscillation: 8,
      spikeCount: 3,
      spikeStrength: 31,
      spikeWidth: 0.036,
      startGap: 72,
      endBias: 0.4,
    },
  }),
  lse: createFixture({
    marketId: 'lse',
    value: 8421.7,
    previousClose: 8398.55,
    currency: 'GBP',
    asOf: '2026-07-31T16:30:00+01:00',
    profile: {
      seed: 'lse',
      trendBias: 0.2,
      volatility: 8.8,
      swing: 0.7,
      driftCurve: 1.28,
      oscillation: 2.4,
      secondaryOscillation: 5.8,
      spikeCount: 1,
      spikeStrength: 10,
      spikeWidth: 0.05,
      startGap: 24,
      endBias: 0.1,
    },
  }),
  nyse: createFixture({
    marketId: 'nyse',
    value: 5508.91,
    previousClose: 5489.22,
    currency: 'USD',
    asOf: '2026-07-31T16:00:00-04:00',
    profile: {
      seed: 'nyse',
      trendBias: 0.28,
      volatility: 5.4,
      swing: 0.6,
      driftCurve: 1.16,
      oscillation: 2.1,
      secondaryOscillation: 4.8,
      spikeCount: 2,
      spikeStrength: 8.5,
      spikeWidth: 0.05,
      startGap: 18,
      endBias: 0.18,
    },
  }),
  hkex: createFixture({
    marketId: 'hkex',
    value: 17652.88,
    previousClose: 17595.14,
    currency: 'HKD',
    asOf: '2026-07-31T16:00:00+08:00',
    profile: {
      seed: 'hkex',
      trendBias: -0.22,
      volatility: 24,
      swing: 1.4,
      driftCurve: 0.88,
      oscillation: 3.9,
      secondaryOscillation: 7.3,
      spikeCount: 4,
      spikeStrength: 28,
      spikeWidth: 0.03,
      startGap: 54,
      endBias: 0.5,
    },
  }),
  xetra: createFixture({
    marketId: 'xetra',
    value: 18512.44,
    previousClose: 18470.11,
    currency: 'EUR',
    asOf: '2026-07-31T17:30:00+02:00',
    profile: {
      seed: 'xetra',
      trendBias: 0.42,
      volatility: 19,
      swing: 1.1,
      driftCurve: 1.05,
      oscillation: 2.9,
      secondaryOscillation: 6.6,
      spikeCount: 3,
      spikeStrength: 18,
      spikeWidth: 0.04,
      startGap: 30,
      endBias: 0.34,
    },
  }),
};
