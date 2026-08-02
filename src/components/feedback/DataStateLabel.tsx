import { StatusBadge } from './StatusBadge';
import type { DataState } from '../../domain/market';

const toneMap: Record<DataState, 'neutral' | 'positive' | 'warning' | 'negative' | 'accent'> = {
  live: 'positive',
  delayed: 'warning',
  'end-of-day': 'neutral',
  cached: 'accent',
  mock: 'neutral',
  unavailable: 'negative',
};

export function DataStateLabel({ state }: { state: DataState }) {
  return <StatusBadge tone={toneMap[state]}>{state.replace('-', ' ')}</StatusBadge>;
}
