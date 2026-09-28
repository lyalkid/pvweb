import type { PhyloNode, PhyloTree } from './types';

export class PhyloTreeModel {
  constructor(private readonly value: PhyloTree) {}

  toObject(): PhyloTree {
    return this.value;
  }

  nodes(): PhyloNode[] {
    const result: PhyloNode[] = [];
    const stack: PhyloNode[] = [this.value.root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) {
        continue;
      }
      result.push(node);
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push(node.children[i]);
      }
    }
    return result;
  }

  leaves(): PhyloNode[] {
    return this.nodes().filter((node) => node.children.length === 0);
  }

  findById(id: string): PhyloNode | null {
    return this.nodes().find((node) => node.id === id) ?? null;
  }

  findByName(name: string): PhyloNode[] {
    return this.nodes().filter((node) => node.name === name);
  }

  find(predicate: (node: PhyloNode) => boolean): PhyloNode | null {
    return this.nodes().find(predicate) ?? null;
  }

  ancestors(nodeId: string): PhyloNode[] {
    const parentById = this.buildParentById();
    const ancestors: PhyloNode[] = [];
    let current = parentById.get(nodeId) ?? null;

    while (current) {
      ancestors.push(current);
      current = parentById.get(current.id) ?? null;
    }

    return ancestors;
  }

  depth(nodeId: string): number {
    const node = this.findById(nodeId);
    if (!node) {
      return -1;
    }
    return this.ancestors(nodeId).length;
  }

  pathLength(nodeId: string): number {
    const node = this.findById(nodeId);
    if (!node) {
      return -1;
    }

    const parentById = this.buildParentById();
    let length = 0;
    let current: PhyloNode | null = node;

    while (current) {
      length += current.branchLength ?? 0;
      current = parentById.get(current.id) ?? null;
    }

    return length;
  }

  maxPathLength(): number {
    return this.leaves().reduce((maxLength, leaf) => {
      return Math.max(maxLength, this.pathLength(leaf.id));
    }, 0);
  }

  leafCount(nodeId: string): number {
    const node = this.findById(nodeId);
    if (!node) {
      return 0;
    }
    return this.countLeaves(node);
  }

  reroot(nodeId: string): PhyloTree {
    if (this.value.root.id === nodeId) {
      return this.cloneTree(this.value.root);
    }

    const path = this.findPathToNode(nodeId);
    if (!path) {
      return this.cloneTree(this.value.root);
    }

    const target = path[path.length - 1];
    const nextRoot = this.cloneNode(target, target.children.map((child) => this.cloneSubtree(child)));
    nextRoot.branchLength = null;

    let currentOriginal = target;
    let currentClone = nextRoot;

    for (let i = path.length - 2; i >= 0; i -= 1) {
      const ancestor = path[i];
      const ancestorClone = this.cloneNode(
        ancestor,
        ancestor.children
          .filter((child) => child.id !== currentOriginal.id)
          .map((child) => this.cloneSubtree(child)),
      );

      ancestorClone.branchLength = currentOriginal.branchLength;
      currentClone.children = [...currentClone.children, ancestorClone];
      currentClone = ancestorClone;
      currentOriginal = ancestor;
    }

    return this.buildTree(nextRoot);
  }

  swapChildren(nodeId: string): PhyloTree {
    const nextRoot = this.mapNode(this.value.root, (node) => {
      if (node.id !== nodeId || node.children.length < 2) {
        return node;
      }

      return this.cloneNode(node, [...node.children].reverse());
    });

    return this.buildTree(nextRoot);
  }

  prune(nodeIds: string[]): PhyloTree {
    const pruneSet = new Set(nodeIds);
    if (pruneSet.size === 0) {
      return this.cloneTree(this.value.root);
    }

    if (pruneSet.has(this.value.root.id)) {
      throw new Error('Cannot prune the root node.');
    }

    const prunedRoot = this.pruneNode(this.value.root, pruneSet);
    if (!prunedRoot) {
      throw new Error('Pruning removed the entire tree.');
    }

    let normalizedRoot = prunedRoot;
    while (normalizedRoot.children.length === 1) {
      normalizedRoot = this.cloneNode(normalizedRoot.children[0], normalizedRoot.children[0].children);
      normalizedRoot.branchLength = null;
    }

    normalizedRoot.branchLength = null;
    return this.buildTree(normalizedRoot);
  }

  ladderize(direction: 'ascending' | 'descending'): PhyloTree {
    const nextRoot = this.ladderizeNode(this.value.root, direction).node;
    nextRoot.branchLength = null;
    return this.buildTree(nextRoot);
  }

  toNewick(): string {
    return `${this.serializeNodeToNewick(this.value.root)};`;
  }

  private buildParentById(): Map<string, PhyloNode | null> {
    const parentById = new Map<string, PhyloNode | null>();
    const stack: Array<{ node: PhyloNode; parent: PhyloNode | null }> = [
      { node: this.value.root, parent: null },
    ];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      parentById.set(current.node.id, current.parent);

      for (let i = current.node.children.length - 1; i >= 0; i -= 1) {
        stack.push({
          node: current.node.children[i],
          parent: current.node,
        });
      }
    }

    return parentById;
  }

  private countLeaves(node: PhyloNode): number {
    if (node.children.length === 0) {
      return 1;
    }

    return node.children.reduce((sum, child) => sum + this.countLeaves(child), 0);
  }

  private cloneTree(root: PhyloNode): PhyloTree {
    return this.buildTree(this.cloneSubtree(root));
  }

  private buildTree(root: PhyloNode): PhyloTree {
    return {
      root,
      metadata: this.buildMetadata(root),
    };
  }

  private buildMetadata(root: PhyloNode) {
    const stats = this.collectStats(root);
    return {
      ...this.value.metadata,
      leafCount: stats.leafCount,
      totalNodes: stats.totalNodes,
      hasBranchLengths: stats.hasBranchLengths,
      hasConfidenceValues: stats.hasConfidenceValues,
    };
  }

  private collectStats(root: PhyloNode): {
    leafCount: number;
    totalNodes: number;
    hasBranchLengths: boolean;
    hasConfidenceValues: boolean;
  } {
    const stack: PhyloNode[] = [root];
    let leafCount = 0;
    let totalNodes = 0;
    let hasBranchLengths = false;
    let hasConfidenceValues = false;

    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) {
        continue;
      }

      totalNodes += 1;
      if (node.children.length === 0) {
        leafCount += 1;
      }
      if (node.branchLength !== null) {
        hasBranchLengths = true;
      }
      if (node.confidence !== null) {
        hasConfidenceValues = true;
      }

      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push(node.children[i]);
      }
    }

    return { leafCount, totalNodes, hasBranchLengths, hasConfidenceValues };
  }

  private findPathToNode(nodeId: string): PhyloNode[] | null {
    const stack: Array<{ node: PhyloNode; path: PhyloNode[] }> = [
      { node: this.value.root, path: [this.value.root] },
    ];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      if (current.node.id === nodeId) {
        return current.path;
      }

      for (let i = current.node.children.length - 1; i >= 0; i -= 1) {
        stack.push({
          node: current.node.children[i],
          path: [...current.path, current.node.children[i]],
        });
      }
    }

    return null;
  }

  private mapNode(node: PhyloNode, mapper: (node: PhyloNode) => PhyloNode): PhyloNode {
    const nextChildren = node.children.map((child) => this.mapNode(child, mapper));
    const nextNode = this.cloneNode(node, nextChildren);
    return mapper(nextNode);
  }

  private pruneNode(node: PhyloNode, pruneSet: Set<string>): PhyloNode | null {
    if (pruneSet.has(node.id)) {
      return null;
    }

    const nextChildren = node.children
      .map((child) => this.pruneNode(child, pruneSet))
      .filter((child): child is PhyloNode => child !== null);

    const nextNode = this.cloneNode(node, nextChildren);
    if (nextNode.children.length !== 1) {
      return nextNode;
    }

    const onlyChild = this.cloneNode(nextNode.children[0], nextNode.children[0].children);
    onlyChild.branchLength = (onlyChild.branchLength ?? 0) + (nextNode.branchLength ?? 0);
    return onlyChild;
  }

  private ladderizeNode(
    node: PhyloNode,
    direction: 'ascending' | 'descending',
  ): { node: PhyloNode; leafCount: number } {
    if (node.children.length === 0) {
      return {
        node: this.cloneNode(node, []),
        leafCount: 1,
      };
    }

    const sortedChildren = node.children
      .map((child) => this.ladderizeNode(child, direction))
      .sort((left, right) => {
        const leafDelta = left.leafCount - right.leafCount;
        const directionDelta = direction === 'ascending' ? leafDelta : -leafDelta;
        if (directionDelta !== 0) {
          return directionDelta;
        }

        const leftKey = left.node.name ?? left.node.id;
        const rightKey = right.node.name ?? right.node.id;
        return leftKey.localeCompare(rightKey);
      });

    return {
      node: this.cloneNode(
        node,
        sortedChildren.map((entry) => entry.node),
      ),
      leafCount: sortedChildren.reduce((sum, entry) => sum + entry.leafCount, 0),
    };
  }

  private cloneSubtree(node: PhyloNode): PhyloNode {
    return this.cloneNode(
      node,
      node.children.map((child) => this.cloneSubtree(child)),
    );
  }

  private cloneNode(node: PhyloNode, children: PhyloNode[]): PhyloNode {
    return {
      id: node.id,
      name: node.name,
      branchLength: node.branchLength,
      confidence: node.confidence,
      children,
      annotations: { ...node.annotations },
    };
  }

  private serializeNodeToNewick(node: PhyloNode): string {
    const children =
      node.children.length > 0
        ? `(${node.children.map((child) => this.serializeNodeToNewick(child)).join(',')})`
        : '';
    const label = this.serializeNodeLabel(node);
    const branchLength = node.branchLength !== null ? `:${this.formatNumber(node.branchLength)}` : '';
    return `${children}${label}${branchLength}`;
  }

  private serializeNodeLabel(node: PhyloNode): string {
    if (node.name) {
      return this.escapeNewickLabel(node.name);
    }
    if (node.confidence !== null) {
      return this.formatNumber(node.confidence);
    }
    return '';
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : String(value);
  }

  private escapeNewickLabel(label: string): string {
    if (!/[\s,:;()[\]']/.test(label)) {
      return label;
    }
    return `'${label.replace(/'/g, "''")}'`;
  }
}
