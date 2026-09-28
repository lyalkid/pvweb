import { readStringArray } from '../tree/tree-state-helpers';
import type { TanglegramSide } from './types';

export interface TanglegramStateSnapshot {
  hiddenConnectionKeys: string[];
  focusedConnectionKey: string | null;
  selectedSide: TanglegramSide | null;
  selectedNodeId: string | null;
  version: number;
}

export class TanglegramState {
  private constructor(
    private readonly hiddenConnectionSet: Set<string>,
    public readonly focusedConnectionKey: string | null,
    public readonly selectedSide: TanglegramSide | null,
    public readonly selectedNodeId: string | null,
    public readonly version: number
  ) {}

  static empty(): TanglegramState {
    return new TanglegramState(new Set(), null, null, null, 0);
  }

  static fromJSON(snapshot: Partial<TanglegramStateSnapshot> | null | undefined): TanglegramState {
    if (!snapshot) {
      return TanglegramState.empty();
    }

    const hiddenConnectionKeys = readStringArray(snapshot.hiddenConnectionKeys);
    const focusedConnectionKey =
      typeof snapshot.focusedConnectionKey === 'string' ? snapshot.focusedConnectionKey : null;
    const selectedSide = snapshot.selectedSide === 'A' || snapshot.selectedSide === 'B'
      ? snapshot.selectedSide
      : null;
    const selectedNodeId =
      typeof snapshot.selectedNodeId === 'string' ? snapshot.selectedNodeId : null;
    const version =
      typeof snapshot.version === 'number' && Number.isFinite(snapshot.version) ? snapshot.version : 0;

    return new TanglegramState(
      new Set(hiddenConnectionKeys),
      focusedConnectionKey,
      selectedSide,
      selectedNodeId,
      version
    );
  }

  hideConnection(connectionKey: string): TanglegramState {
    if (this.hiddenConnectionSet.has(connectionKey)) {
      return this;
    }
    const next = new Set(this.hiddenConnectionSet);
    next.add(connectionKey);
    return new TanglegramState(next, this.focusedConnectionKey, this.selectedSide, this.selectedNodeId, this.version + 1);
  }

  showConnection(connectionKey: string): TanglegramState {
    if (!this.hiddenConnectionSet.has(connectionKey)) {
      return this;
    }
    const next = new Set(this.hiddenConnectionSet);
    next.delete(connectionKey);
    return new TanglegramState(next, this.focusedConnectionKey, this.selectedSide, this.selectedNodeId, this.version + 1);
  }

  toggleConnection(connectionKey: string): TanglegramState {
    return this.hiddenConnectionSet.has(connectionKey)
      ? this.showConnection(connectionKey)
      : this.hideConnection(connectionKey);
  }

  focusConnection(connectionKey: string | null): TanglegramState {
    if (this.focusedConnectionKey === connectionKey) {
      return this;
    }
    return new TanglegramState(
      this.hiddenConnectionSet,
      connectionKey,
      this.selectedSide,
      this.selectedNodeId,
      this.version + 1
    );
  }

  clearFocus(): TanglegramState {
    return this.focusConnection(null);
  }

  toggleFocusedConnection(connectionKey: string): TanglegramState {
    return this.focusedConnectionKey === connectionKey
      ? this.clearFocus()
      : this.focusConnection(connectionKey);
  }

  selectNode(side: TanglegramSide | null, nodeId: string | null): TanglegramState {
    if (this.selectedSide === side && this.selectedNodeId === nodeId) {
      return this;
    }
    return new TanglegramState(
      this.hiddenConnectionSet,
      this.focusedConnectionKey,
      side,
      nodeId,
      this.version + 1
    );
  }

  clearSelection(): TanglegramState {
    return this.selectNode(null, null);
  }

  isConnectionHidden(connectionKey: string): boolean {
    return this.hiddenConnectionSet.has(connectionKey);
  }

  toJSON(): TanglegramStateSnapshot {
    return {
      hiddenConnectionKeys: [...this.hiddenConnectionSet].sort(),
      focusedConnectionKey: this.focusedConnectionKey,
      selectedSide: this.selectedSide,
      selectedNodeId: this.selectedNodeId,
      version: this.version,
    };
  }
}
