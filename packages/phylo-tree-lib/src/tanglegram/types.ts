import type { PhyloTree } from '../tree/types';

export type TanglegramSide = 'A' | 'B';

export interface TanglePair {
  key: string;
  sideA: {
    nodeId: string;
    name: string;
  };
  sideB: {
    nodeId: string;
    name: string;
  };
  sharedLabel: string;
}

export interface TanglegramPairSummary {
  pairs: TanglePair[];
  onlyInA: string[];
  onlyInB: string[];
}

export interface TanglegramTrees {
  treeA: PhyloTree;
  treeB: PhyloTree;
}
