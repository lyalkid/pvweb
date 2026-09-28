import {
  TanglegramState,
  defaultTanglegramRenderOptions,
  defaultTreeRenderOptions,
  type TanglegramRenderOptions,
  type TanglegramStateSnapshot,
  type TreeRenderOptions,
  type ViewStateSnapshot,
} from 'phylo-tree-lib';

interface PersistedTanglegramViewerState {
  compareState: TanglegramStateSnapshot;
  viewStateA: ViewStateSnapshot;
  viewStateB: ViewStateSnapshot;
}

export function mergeTreeRenderOptions(snapshot: Record<string, unknown>): TreeRenderOptions {
  const defaults = defaultTreeRenderOptions();
  return {
    ...defaults,
    ...snapshot,
  } as TreeRenderOptions;
}

export function mergeTanglegramRenderOptions(snapshot: Record<string, unknown>): TanglegramRenderOptions {
  const defaults = defaultTanglegramRenderOptions();
  return {
    ...defaults,
    ...snapshot,
  } as TanglegramRenderOptions;
}

export function normalizeViewStateSnapshot(snapshot: Record<string, unknown>): ViewStateSnapshot {
  return {
    collapsed: Array.isArray(snapshot.collapsed)
      ? snapshot.collapsed.filter((value): value is string => typeof value === 'string')
      : [],
    clusterColors: Array.isArray(snapshot.clusterColors)
      ? snapshot.clusterColors.filter(
          (entry): entry is [string, string] =>
            Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] === 'string' &&
            typeof entry[1] === 'string'
        )
      : [],
    version: typeof snapshot.version === 'number' ? snapshot.version : 0,
  };
}

export function emptyViewStateSnapshot(): ViewStateSnapshot {
  return {
    collapsed: [],
    clusterColors: [],
    version: 0,
  };
}

function emptyTanglegramStateSnapshot(): TanglegramStateSnapshot {
  return TanglegramState.empty().toJSON();
}

export function emptyPersistedTanglegramViewerState(): PersistedTanglegramViewerState {
  return {
    compareState: emptyTanglegramStateSnapshot(),
    viewStateA: emptyViewStateSnapshot(),
    viewStateB: emptyViewStateSnapshot(),
  };
}

export function buildSingleViewStateSignature(
  snapshot: ViewStateSnapshot,
  options: TreeRenderOptions,
  selectedNodeId: string | null
): string {
  return JSON.stringify({
    viewStateJson: snapshot,
    renderOptionsJson: options,
    selectedNodeId,
  });
}

function normalizeTanglegramStateSnapshot(snapshot: Record<string, unknown>): TanglegramStateSnapshot {
  return TanglegramState.fromJSON(snapshot).toJSON();
}

export function normalizePersistedTanglegramViewerState(
  snapshot: Record<string, unknown> | null | undefined
): PersistedTanglegramViewerState {
  if (!snapshot) {
    return emptyPersistedTanglegramViewerState();
  }

  const compareStateSource =
    snapshot.compareState && typeof snapshot.compareState === 'object'
      ? (snapshot.compareState as Record<string, unknown>)
      : snapshot;
  const viewStateASource =
    snapshot.viewStateA && typeof snapshot.viewStateA === 'object'
      ? (snapshot.viewStateA as Record<string, unknown>)
      : null;
  const viewStateBSource =
    snapshot.viewStateB && typeof snapshot.viewStateB === 'object'
      ? (snapshot.viewStateB as Record<string, unknown>)
      : null;

  return {
    compareState: normalizeTanglegramStateSnapshot(compareStateSource),
    viewStateA: viewStateASource ? normalizeViewStateSnapshot(viewStateASource) : emptyViewStateSnapshot(),
    viewStateB: viewStateBSource ? normalizeViewStateSnapshot(viewStateBSource) : emptyViewStateSnapshot(),
  };
}

export function buildTanglegramStateSignature(
  treeAId: string | null,
  treeBId: string | null,
  snapshot: PersistedTanglegramViewerState,
  options: TanglegramRenderOptions
): string {
  return JSON.stringify({
    treeAId,
    treeBId,
    stateJson: snapshot,
    renderOptionsJson: options,
  });
}
