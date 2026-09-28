import type { PhyloTree } from './types';
import { ViewState, type ViewStateSnapshot } from './ViewState';


export interface TreeSnapshot {
  tree: PhyloTree;
  viewState: ViewState;
  workingNewick: string | null;
}


export interface TreeHistoryEntry {
  viewState: ViewStateSnapshot;
  workingNewick: string | null;
}

export function createTreeSnapshot(
  tree: PhyloTree,
  viewState: ViewState = ViewState.empty(),
  workingNewick: string | null = null,
): TreeSnapshot {
  return {
    tree,
    viewState,
    workingNewick,
  };
}

export function updateTreeSnapshot(
  snapshot: TreeSnapshot,
  patch: Partial<TreeSnapshot>,
): TreeSnapshot {
  return {
    tree: patch.tree ?? snapshot.tree,
    viewState: patch.viewState ?? snapshot.viewState,
    workingNewick:
      typeof patch.workingNewick === 'undefined' ? snapshot.workingNewick : patch.workingNewick,
  };
}

export function toTreeHistoryEntry(snapshot: TreeSnapshot): TreeHistoryEntry {
  return {
    viewState: snapshot.viewState.toJSON(),
    workingNewick: snapshot.workingNewick,
  };
}
