import { PhyloTreeModel } from '../tree/PhyloTree';
import type { TanglePair, TanglegramPairSummary } from './types';
import type { PhyloNode, PhyloTree } from '../tree/types';

export function buildTanglegramPairs(treeA: PhyloTree, treeB: PhyloTree): TanglePair[] {
  return summarizeTanglegramPairs(treeA, treeB).pairs;
}

export function summarizeTanglegramPairs(treeA: PhyloTree, treeB: PhyloTree): TanglegramPairSummary {
  const groupsA = groupLeavesByName(treeA);
  const groupsB = groupLeavesByName(treeB);
  const allLabels = new Set<string>([...groupsA.keys(), ...groupsB.keys()]);
  const pairs: TanglePair[] = [];
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];

  for (const label of [...allLabels].sort((left, right) => left.localeCompare(right))) {
    const leavesA = groupsA.get(label) ?? [];
    const leavesB = groupsB.get(label) ?? [];
    const matchedCount = Math.min(leavesA.length, leavesB.length);

    for (let index = 0; index < matchedCount; index += 1) {
      const leafA = leavesA[index];
      const leafB = leavesB[index];
      pairs.push({
        key: buildTanglePairKey(leafA.id, leafB.id),
        sideA: {
          nodeId: leafA.id,
          name: label,
        },
        sideB: {
          nodeId: leafB.id,
          name: label,
        },
        sharedLabel: label,
      });
    }

    if (leavesA.length > matchedCount) {
      for (let index = matchedCount; index < leavesA.length; index += 1) {
        onlyInA.push(label);
      }
    }

    if (leavesB.length > matchedCount) {
      for (let index = matchedCount; index < leavesB.length; index += 1) {
        onlyInB.push(label);
      }
    }
  }

  return {
    pairs,
    onlyInA,
    onlyInB,
  };
}

export function buildTanglePairKey(nodeIdA: string, nodeIdB: string): string {
  return `${nodeIdA}::${nodeIdB}`;
}

function groupLeavesByName(tree: PhyloTree): Map<string, PhyloNode[]> {
  const groups = new Map<string, PhyloNode[]>();
  const leaves = new PhyloTreeModel(tree).leaves().filter((node) => typeof node.name === 'string' && node.name.length > 0);

  for (const leaf of leaves) {
    const label = leaf.name as string;
    const bucket = groups.get(label);
    if (bucket) {
      bucket.push(leaf);
      continue;
    }
    groups.set(label, [leaf]);
  }

  return groups;
}
