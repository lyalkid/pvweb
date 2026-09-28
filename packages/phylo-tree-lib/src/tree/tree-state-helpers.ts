import type { PhyloTree } from './types';

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function readColorEntries(value: unknown): [string, string][] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is [string, string] =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'string'
      )
    : [];
}

export function buildParentById(tree: PhyloTree): Map<string, string | null> {
  const parentById = new Map<string, string | null>();
  const stack: Array<{ node: PhyloTree['root']; parentId: string | null }> = [
    { node: tree.root, parentId: null },
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    parentById.set(current.node.id, current.parentId);
    for (let i = current.node.children.length - 1; i >= 0; i -= 1) {
      stack.push({
        node: current.node.children[i],
        parentId: current.node.id,
      });
    }
  }

  return parentById;
}

export function resolveColorByParentMap(
  nodeId: string,
  parentById: Map<string, string | null>,
  colorMap: Map<string, string>
): string | null {
  let current: string | null = nodeId;
  while (current) {
    const color = colorMap.get(current);
    if (color) {
      return color;
    }
    current = parentById.get(current) ?? null;
  }
  return null;
}

export function hasCollapsedAncestorByParentMap(
  nodeId: string,
  parentById: Map<string, string | null>,
  collapsedSet: Set<string>
): boolean {
  let current = parentById.get(nodeId) ?? null;
  while (current) {
    if (collapsedSet.has(current)) {
      return true;
    }
    current = parentById.get(current) ?? null;
  }
  return false;
}
