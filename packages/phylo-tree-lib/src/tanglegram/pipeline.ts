import { ViewState } from '../tree/ViewState';
import type { PhyloTree } from '../tree/types';
import { computeTanglegramLayout, type TanglegramLayout } from './layout';
import { summarizeTanglegramPairs } from './matching';
import type { TanglegramRenderOptions } from './render-options';
import type { TanglegramPairSummary } from './types';

export interface BuildTanglegramModelInput {
  treeA: PhyloTree;
  treeB: PhyloTree;
  options: TanglegramRenderOptions;
  viewStateA?: ViewState | null;
  viewStateB?: ViewState | null;
}

export interface BuiltTanglegramModel {
  summary: TanglegramPairSummary;
  layout: TanglegramLayout;
}

export function buildTanglegramModel(input: BuildTanglegramModelInput): BuiltTanglegramModel {
  const summary = summarizeTanglegramPairs(input.treeA, input.treeB);
  const layout = computeTanglegramLayout(
    input.treeA,
    input.treeB,
    summary.pairs,
    input.options,
    {
      viewStateA: input.viewStateA ?? ViewState.empty(),
      viewStateB: input.viewStateB ?? ViewState.empty(),
    }
  );

  return {
    summary,
    layout,
  };
}
