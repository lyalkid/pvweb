import { PhyloTreeModel } from './PhyloTree';
import { ViewState } from './ViewState';
import type { PhyloTree } from './types';
import type { TanglegramSide, TanglegramTrees } from '../tanglegram/types';

export type TreeStructureAction =
  | { type: 'reroot'; nodeId: string }
  | { type: 'swapChildren'; nodeId: string }
  | { type: 'prune'; nodeId: string }
  | { type: 'ladderize'; direction: 'ascending' | 'descending' };

export type TreeViewAction =
  | { type: 'collapse'; nodeId: string }
  | { type: 'expand'; nodeId: string }
  | { type: 'toggleCollapse'; nodeId: string }
  | { type: 'setColor'; nodeId: string; color: string }
  | { type: 'clearColor'; nodeId: string }
  | { type: 'expandAll' }
  | { type: 'clearAllColors' };

export function applyTreeStructureAction(tree: PhyloTree, action: TreeStructureAction): PhyloTree {
  const model = new PhyloTreeModel(tree);

  switch (action.type) {
    case 'reroot':
      return model.reroot(action.nodeId);
    case 'swapChildren':
      return model.swapChildren(action.nodeId);
    case 'prune':
      return model.prune([action.nodeId]);
    case 'ladderize':
      return model.ladderize(action.direction);
  }
}

export function applyTanglegramSideTreeAction(
  trees: TanglegramTrees,
  side: TanglegramSide,
  action: TreeStructureAction
): TanglegramTrees {
  if (side === 'A') {
    return {
      treeA: applyTreeStructureAction(trees.treeA, action),
      treeB: trees.treeB,
    };
  }

  return {
    treeA: trees.treeA,
    treeB: applyTreeStructureAction(trees.treeB, action),
  };
}

export function applyTreeViewAction(viewState: ViewState, action: TreeViewAction): ViewState {
  switch (action.type) {
    case 'collapse':
      return viewState.collapse(action.nodeId);
    case 'expand':
      return viewState.expand(action.nodeId);
    case 'toggleCollapse':
      return viewState.isCollapsed(action.nodeId)
        ? viewState.expand(action.nodeId)
        : viewState.collapse(action.nodeId);
    case 'setColor':
      return viewState.setColor(action.nodeId, action.color);
    case 'clearColor':
      return viewState.clearColor(action.nodeId);
    case 'expandAll':
      return viewState.expandAll();
    case 'clearAllColors':
      return viewState.clearAllColors();
  }
}

export function applyTanglegramSideViewAction(
  states: { viewStateA: ViewState; viewStateB: ViewState },
  side: TanglegramSide,
  action: TreeViewAction
): { viewStateA: ViewState; viewStateB: ViewState } {
  if (side === 'A') {
    return {
      viewStateA: applyTreeViewAction(states.viewStateA, action),
      viewStateB: states.viewStateB,
    };
  }

  return {
    viewStateA: states.viewStateA,
    viewStateB: applyTreeViewAction(states.viewStateB, action),
  };
}
