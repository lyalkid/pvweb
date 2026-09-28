export interface PhyloTree {
  root: PhyloNode;
  metadata: TreeMetadata;
}

export interface PhyloNode {
  id: string;
  name: string | null;
  branchLength: number | null;
  confidence: number | null;
  children: PhyloNode[];
  annotations: Record<string, unknown>;
}

export interface TreeMetadata {
  format: 'newick' | 'nexus' | 'phyloxml';
  name: string | null;
  isRooted: boolean;
  leafCount: number;
  totalNodes: number;
  hasBranchLengths: boolean;
  hasConfidenceValues: boolean;
}

export interface ParseResult {
  tree: PhyloTree;
  warnings: string[];
}
