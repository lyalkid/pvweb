import type { PhyloTree } from './types';
import {
  buildParentById,
  hasCollapsedAncestorByParentMap,
  readColorEntries,
  readStringArray,
  resolveColorByParentMap,
} from './tree-state-helpers';

export interface ViewStateSnapshot {
  collapsed: string[];
  clusterColors: [string, string][];
  version: number;
}

export interface ResolvedNodeViewState {
  hiddenByCollapse: boolean;
  inheritedColor: string | null;
}

interface ResolvedTreeViewState {
  byNodeId: Map<string, ResolvedNodeViewState>;
}

/**
 * ViewState хранит состояние представления дерева (UI),
 * а не структуру самого дерева.
 *
 * Назначение:
 * - сериализуемый snapshot для сохранения/восстановления состояния проекта;
 * - иммутабельные операции для удобного undo/redo;
 * - единый контракт между UI и renderer.
 *
 * Что хранится:
 * - collapsed: id свернутых узлов (их поддеревья скрываются);
 * - clusterColors: переопределения цвета узла по id;
 * - version: версия snapshot/счётчик изменений.
 */
export class ViewState {
  private constructor(
    private readonly collapsedSet: Set<string>,
    private readonly clusterColorMap: Map<string, string>,
    public readonly version: number
  ) {}

  static empty(): ViewState {
    return new ViewState(new Set(), new Map(), 0);
  }

  static fromJSON(snapshot: Partial<ViewStateSnapshot> | null | undefined): ViewState {
    if (!snapshot) {
      return ViewState.empty();
    }

    const collapsed = readStringArray(snapshot.collapsed);
    const colors = readColorEntries(snapshot.clusterColors);
    const version = typeof snapshot.version === 'number' && Number.isFinite(snapshot.version)
      ? snapshot.version
      : 0;

    return new ViewState(new Set(collapsed), new Map(colors), version);
  }

  collapse(nodeId: string): ViewState {
    if (this.collapsedSet.has(nodeId)) {
      return this;
    }
    const next = new Set(this.collapsedSet);
    next.add(nodeId);
    return new ViewState(next, this.clusterColorMap, this.version + 1);
  }

  expand(nodeId: string): ViewState {
    if (!this.collapsedSet.has(nodeId)) {
      return this;
    }
    const next = new Set(this.collapsedSet);
    next.delete(nodeId);
    return new ViewState(next, this.clusterColorMap, this.version + 1);
  }

  setColor(nodeId: string, color: string): ViewState {
    if (this.clusterColorMap.get(nodeId) === color) {
      return this;
    }
    const next = new Map(this.clusterColorMap);
    next.set(nodeId, color);
    return new ViewState(this.collapsedSet, next, this.version + 1);
  }

  clearColor(nodeId: string): ViewState {
    if (!this.clusterColorMap.has(nodeId)) {
      return this;
    }
    const next = new Map(this.clusterColorMap);
    next.delete(nodeId);
    return new ViewState(this.collapsedSet, next, this.version + 1);
  }

  collapseAll(nodeIds: string[]): ViewState {
    const filtered = nodeIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (filtered.length === 0) {
      return this;
    }

    const next = new Set(this.collapsedSet);
    let changed = false;
    for (const nodeId of filtered) {
      if (next.has(nodeId)) {
        continue;
      }
      next.add(nodeId);
      changed = true;
    }

    return changed ? new ViewState(next, this.clusterColorMap, this.version + 1) : this;
  }

  expandAll(): ViewState {
    if (this.collapsedSet.size === 0) {
      return this;
    }
    return new ViewState(new Set(), this.clusterColorMap, this.version + 1);
  }

  clearAllColors(): ViewState {
    if (this.clusterColorMap.size === 0) {
      return this;
    }
    return new ViewState(this.collapsedSet, new Map(), this.version + 1);
  }

  isCollapsed(nodeId: string): boolean {
    return this.collapsedSet.has(nodeId);
  }

  getColor(nodeId: string): string | null {
    return this.clusterColorMap.get(nodeId) ?? null;
  }

  resolveColor(nodeId: string, tree: PhyloTree): string | null {
    return resolveColorByParentMap(nodeId, buildParentById(tree), this.clusterColorMap);
  }

  resolveForParentMap(parentById: Map<string, string | null>): ResolvedTreeViewState {
    const byNodeId = new Map<string, ResolvedNodeViewState>();

    for (const nodeId of parentById.keys()) {
      byNodeId.set(nodeId, {
        hiddenByCollapse: hasCollapsedAncestorByParentMap(nodeId, parentById, this.collapsedSet),
        inheritedColor: resolveColorByParentMap(nodeId, parentById, this.clusterColorMap),
      });
    }

    return { byNodeId };
  }

  toJSON(): ViewStateSnapshot {
    return {
      collapsed: [...this.collapsedSet].sort(),
      clusterColors: [...this.clusterColorMap.entries()].sort(([a], [b]) => a.localeCompare(b)),
      version: this.version,
    };
  }
}
