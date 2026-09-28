import type { PositionedNode } from '../core/types';

function collectVisibleLeafDescendants(
  nodeId: string,
  byId: Map<string, PositionedNode>
): PositionedNode[] {
  const start = byId.get(nodeId);
  if (!start) {
    return [];
  }
  const out: PositionedNode[] = [];
  const stack: PositionedNode[] = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.node.children.length === 0 || current.collapsed) {
      out.push(current);
      continue;
    }
    for (const child of current.node.children) {
      const visibleChild = byId.get(child.id);
      if (visibleChild) {
        stack.push(visibleChild);
      }
    }
  }
  return out;
}

export function collectVisibleDescendantIds(
  nodeId: string,
  byId: Map<string, PositionedNode>
): string[] {
  const start = byId.get(nodeId);
  if (!start) {
    return [];
  }

  const out: string[] = [];
  const stack: PositionedNode[] = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    out.push(current.node.id);
    if (current.collapsed) {
      continue;
    }
    for (const child of current.node.children) {
      const visibleChild = byId.get(child.id);
      if (visibleChild) {
        stack.push(visibleChild);
      }
    }
  }
  return out;
}

export function buildTooltipText(item: PositionedNode, byId: Map<string, PositionedNode>): string {
  const name = item.node.name ?? item.node.id;
  const branch = item.node.branchLength ?? 0;
  if (item.node.children.length === 0 || item.collapsed) {
    const leaves = item.collapsed ? item.subtreeLeafCount ?? 1 : 1;
    return `${name} | branch=${branch} | leaves=${leaves}`;
  }
  const visibleLeaves = collectVisibleLeafDescendants(item.node.id, byId).length;
  return `${name} | branch=${branch} | visible leaves=${visibleLeaves}`;
}
