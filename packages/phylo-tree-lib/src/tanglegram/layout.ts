import type { PositionedNode } from '../renderer/core/types';
import { layoutRectangular } from '../renderer/layout/layouts';
import { ViewState } from '../tree/ViewState';
import type { PhyloTree } from '../tree/types';
import type { TanglePair } from './types';
import type { TanglegramRenderOptions } from './render-options';

export interface TanglegramSideLayout {
  nodes: PositionedNode[];
  nodeById: Map<string, PositionedNode>;
  offsetX: number;
  width: number;
  height: number;
  mirror: boolean;
}

export interface TanglegramConnectionLayout {
  key: string;
  sideANodeId: string;
  sideBNodeId: string;
  label: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface TanglegramLayout {
  width: number;
  height: number;
  sideA: TanglegramSideLayout;
  sideB: TanglegramSideLayout;
  connections: TanglegramConnectionLayout[];
}

export function computeTanglegramLayout(
  treeA: PhyloTree,
  treeB: PhyloTree,
  pairs: TanglePair[],
  options: TanglegramRenderOptions,
  state?: {
    viewStateA?: ViewState | null;
    viewStateB?: ViewState | null;
  }
): TanglegramLayout {
  const targetSideWidth = Math.max(120, (options.width - options.gap) / 2);
  const targetSideHeight = options.height;
  const viewStateA = state?.viewStateA ?? ViewState.empty();
  const viewStateB = state?.viewStateB ?? ViewState.empty();
  const collapsedA = new Set(viewStateA.toJSON().collapsed);
  const collapsedB = new Set(viewStateB.toJSON().collapsed);

  const nodesA = layoutRectangular(treeA.root, {
    width: targetSideWidth,
    height: targetSideHeight,
    mirror: false,
    useBranchLength: options.useBranchLengthsA,
    alignTips: true,
    layoutSpacingX: 1,
    layoutSpacingY: 1,
    startAngle: 0,
    arcAngle: 360,
    collapsedIds: collapsedA,
  });
  const nodesB = layoutRectangular(treeB.root, {
    width: targetSideWidth,
    height: targetSideHeight,
    mirror: true,
    useBranchLength: options.useBranchLengthsB,
    alignTips: true,
    layoutSpacingX: 1,
    layoutSpacingY: 1,
    startAngle: 0,
    arcAngle: 360,
    collapsedIds: collapsedB,
  });

  const sideA = createSideLayout(nodesA, false, options.layoutSpacingXA, options.layoutSpacingYA);
  const sideB = createSideLayout(nodesB, true, options.layoutSpacingXB, options.layoutSpacingYB);
  const layoutHeight = Math.max(sideA.height, sideB.height, options.height);
  const centeredSideA = centerSideVertically(sideA, layoutHeight);
  const centeredSideB = centerSideVertically(sideB, layoutHeight);
  const placedSideA = placeSide(centeredSideA, 0);
  const placedSideB = placeSide(centeredSideB, centeredSideA.width + options.gap);
  const connections: TanglegramConnectionLayout[] = [];

  for (const pair of pairs) {
    const nodeA = placedSideA.nodeById.get(pair.sideA.nodeId);
    const nodeB = placedSideB.nodeById.get(pair.sideB.nodeId);
    if (!nodeA || !nodeB) {
      continue;
    }

    connections.push({
      key: pair.key,
      sideANodeId: pair.sideA.nodeId,
      sideBNodeId: pair.sideB.nodeId,
      label: pair.sharedLabel,
      startX: nodeA.x,
      startY: nodeA.y,
      endX: nodeB.x,
      endY: nodeB.y,
    });
  }

  return {
    width: placedSideA.width + options.gap + placedSideB.width,
    height: layoutHeight,
    sideA: placedSideA,
    sideB: placedSideB,
    connections,
  };
}

function createSideLayout(
  nodes: PositionedNode[],
  mirror: boolean,
  scaleX: number,
  scaleY: number
): TanglegramSideLayout {
  const scaled = applySideScaling(nodes, scaleX, scaleY);
  const normalized = normalizeSideNodes(scaled);
  const sideWidth = computeSideWidth(normalized);
  const sideHeight = computeSideHeight(normalized);
  return {
    nodes: normalized,
    nodeById: new Map(normalized.map((node) => [node.node.id, node])),
    offsetX: 0,
    width: sideWidth,
    height: sideHeight,
    mirror,
  };
}


function applySideScaling(
  nodes: PositionedNode[],
  scaleX: number,
  scaleY: number
): PositionedNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const normalizedScaleX = Number.isFinite(scaleX) ? Math.max(0.2, scaleX) : 1;
  const normalizedScaleY = Number.isFinite(scaleY) ? Math.max(0.1, scaleY) : 1;
  const root = nodes.find((node) => node.parentId === null) ?? nodes[0];
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const visibleCenterY = (minY + maxY) / 2;
  const anchorX = root.x;
  const anchorY = Number.isFinite(visibleCenterY) ? visibleCenterY : 0;

  return nodes.map((node) => ({
    ...node,
    x: anchorX + (node.x - anchorX) * normalizedScaleX,
    y: anchorY + (node.y - anchorY) * normalizedScaleY,
  }));
}

function normalizeSideNodes(nodes: PositionedNode[]): PositionedNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));

  return nodes.map((node) => ({
    ...node,
    x: node.x - minX + 16,
    y: node.y - minY + 16,
  }));
}

function centerSideVertically(side: TanglegramSideLayout, targetHeight: number): TanglegramSideLayout {
  const deltaY = Math.max(0, (targetHeight - side.height) / 2);
  if (deltaY === 0) {
    return side;
  }

  const shifted = side.nodes.map((node) => ({
    ...node,
    y: node.y + deltaY,
  }));

  return {
    ...side,
    nodes: shifted,
    nodeById: new Map(shifted.map((node) => [node.node.id, node])),
  };
}

function placeSide(side: TanglegramSideLayout, offsetX: number): TanglegramSideLayout {
  const shifted = side.nodes.map((node) => ({
    ...node,
    x: node.x + offsetX,
  }));

  return {
    ...side,
    nodes: shifted,
    nodeById: new Map(shifted.map((node) => [node.node.id, node])),
    offsetX,
  };
}

function computeSideWidth(nodes: PositionedNode[]): number {
  if (nodes.length === 0) {
    return 32;
  }
  const maxX = Math.max(...nodes.map((node) => node.x));
  return maxX + 16;
}

function computeSideHeight(nodes: PositionedNode[]): number {
  if (nodes.length === 0) {
    return 32;
  }
  const maxY = Math.max(...nodes.map((node) => node.y));
  return maxY + 16;
}
