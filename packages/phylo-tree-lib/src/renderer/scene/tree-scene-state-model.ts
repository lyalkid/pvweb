import type { ResolvedNodeViewState, ViewState } from '../../tree/ViewState';
import type { TreeRenderOptions } from '../render-options';

interface BuiltSceneNodeViewState {
  hidden: boolean;
  inheritedColor: string | null;
  labelsVisible: boolean;
}

export interface BuiltSceneElementState {
  opacity?: string;
  pointerEvents?: string;
  fill?: string;
  stroke?: string;
}

interface BuiltSceneStateModel {
  byNodeId: Map<string, BuiltSceneNodeViewState>;
  nodeElementsById: Map<string, BuiltSceneElementState>;
  collapseMarkerElementsById: Map<string, BuiltSceneElementState>;
  labelElementsById: Map<string, BuiltSceneElementState>;
  leaderElementsByNodeId: Map<string, BuiltSceneElementState>;
  lineElementsByChildId: Map<string, BuiltSceneElementState>;
}

export function buildBuiltSceneStateModel(
  viewState: ViewState,
  parentById: Map<string, string | null>,
  options: TreeRenderOptions
): BuiltSceneStateModel {
  const resolved = viewState.resolveForParentMap(parentById);
  const byNodeId = new Map<string, BuiltSceneNodeViewState>();
  const nodeElementsById = new Map<string, BuiltSceneElementState>();
  const collapseMarkerElementsById = new Map<string, BuiltSceneElementState>();
  const labelElementsById = new Map<string, BuiltSceneElementState>();
  const leaderElementsByNodeId = new Map<string, BuiltSceneElementState>();
  const lineElementsByChildId = new Map<string, BuiltSceneElementState>();

  for (const [nodeId, nodeState] of resolved.byNodeId.entries()) {
    const sceneNodeState = toBuiltSceneNodeViewState(nodeState, options);
    byNodeId.set(nodeId, sceneNodeState);
    nodeElementsById.set(nodeId, buildNodeElementState(sceneNodeState, options));
    collapseMarkerElementsById.set(
      nodeId,
      buildCollapseMarkerElementState(sceneNodeState, options)
    );
    labelElementsById.set(nodeId, buildLabelElementState(sceneNodeState, options));
    leaderElementsByNodeId.set(nodeId, buildLeaderElementState(sceneNodeState, options));
    lineElementsByChildId.set(nodeId, buildLineElementState(sceneNodeState, options));
  }

  return {
    byNodeId,
    nodeElementsById,
    collapseMarkerElementsById,
    labelElementsById,
    leaderElementsByNodeId,
    lineElementsByChildId,
  };
}

function toBuiltSceneNodeViewState(
  nodeState: ResolvedNodeViewState,
  options: TreeRenderOptions
): BuiltSceneNodeViewState {
  return {
    hidden: nodeState.hiddenByCollapse,
    inheritedColor: nodeState.inheritedColor,
    labelsVisible: !nodeState.hiddenByCollapse && options.showLabels,
  };
}

function buildNodeElementState(
  nodeState: BuiltSceneNodeViewState,
  options: TreeRenderOptions
): BuiltSceneElementState {
  return {
    opacity: nodeState.hidden ? '0' : '1',
    pointerEvents: nodeState.hidden ? 'none' : '',
    fill: nodeState.inheritedColor ?? options.nodeColor,
  };
}

function buildCollapseMarkerElementState(
  nodeState: BuiltSceneNodeViewState,
  options: TreeRenderOptions
): BuiltSceneElementState {
  const color = nodeState.inheritedColor ?? options.nodeColor;
  return {
    fill: color,
    stroke: color,
  };
}

function buildLabelElementState(
  nodeState: BuiltSceneNodeViewState,
  options: TreeRenderOptions
): BuiltSceneElementState {
  return {
    opacity: nodeState.labelsVisible ? '1' : '0',
    pointerEvents: nodeState.labelsVisible ? '' : 'none',
    fill: nodeState.inheritedColor ?? options.branchColor,
  };
}

function buildLeaderElementState(
  nodeState: BuiltSceneNodeViewState,
  options: TreeRenderOptions
): BuiltSceneElementState {
  return {
    opacity: nodeState.labelsVisible ? '1' : '0',
    pointerEvents: 'none',
    stroke: nodeState.inheritedColor ?? options.branchColor,
  };
}

function buildLineElementState(
  nodeState: BuiltSceneNodeViewState,
  options: TreeRenderOptions
): BuiltSceneElementState {
  return {
    opacity: nodeState.hidden ? '0' : '1',
    pointerEvents: nodeState.hidden ? 'none' : '',
    stroke: nodeState.inheritedColor ?? options.branchColor,
  };
}
