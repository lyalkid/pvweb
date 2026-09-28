import type { PhyloNode, PhyloTree, TreeMetadata } from '../tree/types';

function collectNodes(root: PhyloNode): PhyloNode[] {
  const result: PhyloNode[] = [];
  const stack = [root];

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

export function buildTreeFromRoot(
  root: PhyloNode,
  format: TreeMetadata['format'],
  overrides?: Partial<Omit<TreeMetadata, 'format' | 'leafCount' | 'totalNodes' | 'hasBranchLengths' | 'hasConfidenceValues'>>
): PhyloTree {
  const nodes = collectNodes(root);

  return {
    root,
    metadata: {
      format,
      name: overrides?.name ?? root.name,
      isRooted: overrides?.isRooted ?? true,
      leafCount: nodes.filter((node) => node.children.length === 0).length,
      totalNodes: nodes.length,
      hasBranchLengths: nodes.some((node) => node.branchLength !== null),
      hasConfidenceValues: nodes.some((node) => node.confidence !== null),
    },
  };
}
