import type { PhyloTree } from '../../tree/types';
import { ViewState } from '../../tree/ViewState';
import { layoutCircular, layoutRectangular, type TreeLayoutConfig } from '../layout/layouts';
import { isCircularMode, isPhylogramMode, isRectangularMode } from './mode-utils';
import type { TreeRenderOptions } from '../render-options';
import type { PositionedNode } from '../core/types';
import type { SceneBuildOptions } from '../scene/tree-scene';

export interface TreeRuntimePolicy {
  denseTree: boolean;
  veryDenseTree: boolean;
  renderLabels: boolean;
}

export interface TreeRuntimePlan {
  requestedOptions: TreeRenderOptions;
  effectiveOptions: TreeRenderOptions;
  policy: TreeRuntimePolicy;
  scene: SceneBuildOptions;
}

interface TreeVisualUpdatePlan {
  requestedOptions: TreeRenderOptions;
  effectiveOptions: TreeRenderOptions;
  requiresRebuild: boolean;
}

type TreeLayoutKind = 'rectangular' | 'circular';

interface TreeLayoutPlan {
  kind: TreeLayoutKind;
  config: TreeLayoutConfig;
}

interface TreeOptionNormalizationInput {
  requestedOptions: TreeRenderOptions;
  policy: TreeRuntimePolicy;
  tree: PhyloTree;
}

interface TreeLayoutInput {
  tree: PhyloTree;
  options: TreeRenderOptions;
  viewState: ViewState;
}

export function computeTreeLayout(
  tree: PhyloTree,
  cfg: TreeRenderOptions,
  viewState: ViewState = ViewState.empty()
): PositionedNode[] {
  const layoutPlan = buildTreeLayoutPlan({
    tree,
    options: cfg,
    viewState,
  });

  if (layoutPlan.kind === 'circular') {
    return layoutCircular(tree.root, layoutPlan.config);
  }

  return layoutRectangular(tree.root, layoutPlan.config);
}

function hasTreeStructuralChanges(
  prev: TreeRenderOptions,
  next: TreeRenderOptions
): boolean {
  return (
    prev.mode !== next.mode ||
    prev.width !== next.width ||
    prev.height !== next.height ||
    prev.mirror !== next.mirror ||
    prev.alignTips !== next.alignTips ||
    prev.layoutSpacingX !== next.layoutSpacingX ||
    prev.layoutSpacingY !== next.layoutSpacingY ||
    prev.startAngle !== next.startAngle ||
    prev.arcAngle !== next.arcAngle
  );
}

export function buildTreeVisualUpdatePlan(
  tree: PhyloTree,
  previousRequestedOptions: TreeRenderOptions,
  nextRequestedOptions: TreeRenderOptions
): TreeVisualUpdatePlan {
  const policy = buildTreeRuntimePolicy(tree, nextRequestedOptions);
  return {
    requestedOptions: nextRequestedOptions,
    effectiveOptions: normalizeTreeRenderOptions({
      requestedOptions: nextRequestedOptions,
      policy,
      tree,
    }),
    requiresRebuild: hasTreeStructuralChanges(previousRequestedOptions, nextRequestedOptions),
  };
}

export function buildTreeRuntimePlan(
  tree: PhyloTree,
  cfg: TreeRenderOptions
): TreeRuntimePlan {
  const policy = buildTreeRuntimePolicy(tree, cfg);
  const effectiveOptions = normalizeTreeRenderOptions({
    requestedOptions: cfg,
    policy,
    tree,
  });

  return {
    requestedOptions: cfg,
    effectiveOptions,
    policy,
    scene: buildTreeSceneBuildOptions(policy),
  };
}

export function buildTreeRuntimePolicy(
  tree: PhyloTree,
  requestedOptions: TreeRenderOptions
): TreeRuntimePolicy {
  const leafCount = tree.metadata.leafCount;
  const denseTree = leafCount >= 2000 || tree.metadata.totalNodes >= 4000;
  const veryDenseTree = leafCount >= 6000 || tree.metadata.totalNodes >= 12000;
  const renderLabels = requestedOptions.showLabels && leafCount <= 1500;

  return {
    denseTree,
    veryDenseTree,
    renderLabels,
  };
}

export function normalizeTreeRenderOptions(
  input: TreeOptionNormalizationInput
): TreeRenderOptions {
  const { requestedOptions, policy, tree } = input;
  const minRowHeight = policy.renderLabels ? 12 : 3;
  const height = isRectangularMode(requestedOptions.mode)
    ? Math.max(requestedOptions.height, 80 + tree.metadata.leafCount * minRowHeight)
    : requestedOptions.height;

  return {
    ...requestedOptions,
    height,
    showLabels: policy.renderLabels,
    nodeSize: policy.denseTree
      ? Math.min(requestedOptions.nodeSize, policy.veryDenseTree ? 1 : 1.5)
      : requestedOptions.nodeSize,
    branchWidth: policy.denseTree
      ? Math.min(requestedOptions.branchWidth, 1)
      : requestedOptions.branchWidth,
  };
}

export function buildTreeSceneBuildOptions(
  policy: TreeRuntimePolicy
): SceneBuildOptions {
  return {
    enableTransitions: !policy.denseTree,
    renderLabels: policy.renderLabels,
  };
}

function buildTreeLayoutConfig(
  input: TreeLayoutInput
): TreeLayoutConfig {
  const { options, viewState } = input;

  return {
    width: options.width,
    height: options.height,
    mirror: options.mirror,
    useBranchLength: isPhylogramMode(options.mode),
    alignTips: options.alignTips,
    layoutSpacingX: options.layoutSpacingX,
    layoutSpacingY: options.layoutSpacingY,
    startAngle: options.startAngle,
    arcAngle: options.arcAngle,
    collapsedIds: buildCollapsedIdSet(viewState),
  };
}

function buildCollapsedIdSet(viewState: ViewState): Set<string> {
  return new Set(viewState.toJSON().collapsed);
}

export function resolveTreeLayoutKind(
  options: TreeRenderOptions
): TreeLayoutKind {
  return isCircularMode(options.mode) ? 'circular' : 'rectangular';
}

export function buildTreeLayoutPlan(
  input: TreeLayoutInput
): TreeLayoutPlan {
  return {
    kind: resolveTreeLayoutKind(input.options),
    config: buildTreeLayoutConfig(input),
  };
}
