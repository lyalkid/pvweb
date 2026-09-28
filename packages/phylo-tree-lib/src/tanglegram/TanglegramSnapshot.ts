import { ViewState } from '../tree/ViewState';
import type { TanglegramTrees } from './types';
import { TanglegramState } from './TanglegramState';

export interface TanglegramSnapshot {
  trees: TanglegramTrees;
  viewStateA: ViewState;
  viewStateB: ViewState;
  compareState: TanglegramState;
  sourceNewickA: string;
  sourceNewickB: string;
}

export function createTanglegramSnapshot(
  trees: TanglegramTrees,
  options?: Partial<Omit<TanglegramSnapshot, 'trees'>>
): TanglegramSnapshot {
  return {
    trees,
    viewStateA: options?.viewStateA ?? ViewState.empty(),
    viewStateB: options?.viewStateB ?? ViewState.empty(),
    compareState: options?.compareState ?? TanglegramState.empty(),
    sourceNewickA: options?.sourceNewickA ?? '',
    sourceNewickB: options?.sourceNewickB ?? '',
  };
}

export function updateTanglegramSnapshot(
  snapshot: TanglegramSnapshot,
  patch: Partial<TanglegramSnapshot>
): TanglegramSnapshot {
  return {
    trees: patch.trees ?? snapshot.trees,
    viewStateA: patch.viewStateA ?? snapshot.viewStateA,
    viewStateB: patch.viewStateB ?? snapshot.viewStateB,
    compareState: patch.compareState ?? snapshot.compareState,
    sourceNewickA: typeof patch.sourceNewickA === 'undefined'
      ? snapshot.sourceNewickA
      : patch.sourceNewickA,
    sourceNewickB: typeof patch.sourceNewickB === 'undefined'
      ? snapshot.sourceNewickB
      : patch.sourceNewickB,
  };
}
