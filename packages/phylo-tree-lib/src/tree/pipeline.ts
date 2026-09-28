import type { PositionedNode } from '../renderer/core/types';
import type { SceneBuildOptions } from '../renderer/scene/tree-scene';
import type { TreeRenderOptions } from '../renderer/render-options';
import {
  buildTreeRuntimePlan,
  computeTreeLayout,
  type TreeRuntimePlan,
} from '../renderer/runtime/tree-runtime';
import type { PhyloTree } from './types';
import { ViewState } from './ViewState';

export interface BuildTreeRenderModelInput {
  tree: PhyloTree;
  options: TreeRenderOptions;
  viewState?: ViewState | null;
}

export interface BuiltTreeRenderModel {
  tree: PhyloTree;
  viewState: ViewState;
  requestedOptions: TreeRenderOptions;
  effectiveOptions: TreeRenderOptions;
  runtime: TreeRuntimePlan;
  scene: SceneBuildOptions;
  layout: PositionedNode[];
}

export function buildTreeRenderModel(
  input: BuildTreeRenderModelInput,
): BuiltTreeRenderModel {
  const viewState = input.viewState ?? ViewState.empty();
  const runtime = buildTreeRuntimePlan(input.tree, input.options);
  const layout = computeTreeLayout(input.tree, runtime.effectiveOptions, viewState);

  return {
    tree: input.tree,
    viewState,
    requestedOptions: input.options,
    effectiveOptions: runtime.effectiveOptions,
    runtime,
    scene: runtime.scene,
    layout,
  };
}
