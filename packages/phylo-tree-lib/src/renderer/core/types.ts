import type { PhyloNode } from '../../tree/types';

export interface PositionedNode {
  node: PhyloNode;
  x: number;
  y: number;
  parentId: string | null;
  collapsed?: boolean;
  subtreeLeafCount?: number;
  rowHeight?: number;
  angle?: number;
}

export interface NodeClickPayload {
  nodeId: string;
}

export interface NodeHoverPayload {
  nodeId: string | null;
}

export interface RendererEventMap {
  nodeClick: NodeClickPayload;
  nodeHover: NodeHoverPayload;
  backgroundClick: null;
}

export type RendererEvent = keyof RendererEventMap;
export type EventHandler<TPayload> = (payload: TPayload, e: MouseEvent) => void;

export interface ViewTransform {
  x: number;
  y: number;
  k: number;
}
