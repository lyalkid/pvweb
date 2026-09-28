import type { PositionedNode } from '../renderer/core/types';
import { ViewState } from '../tree/ViewState';
import type { TanglegramState } from './TanglegramState';
import type { TanglegramLayout, TanglegramSideLayout } from './layout';
import type { TanglegramConnectionDensityMode, TanglegramConnectionVisibilityMode, TanglegramLabelDensityMode, TanglegramRenderOptions } from './render-options';
import type { TanglegramSide } from './types';

export interface TanglegramSceneInput {
  layout: TanglegramLayout;
  state: TanglegramState;
  viewStateA?: ViewState | null;
  viewStateB?: ViewState | null;
  options: TanglegramRenderOptions;
  onNodeClick?: (payload: { side: TanglegramSide; nodeId: string }, event: MouseEvent) => void;
  onConnectionClick?: (payload: { connectionKey: string }, event: MouseEvent) => void;
}

export interface TanglegramRenderedScene {
  rootLayer: SVGGElement;
  connectionsLayer: SVGGElement;
  treeLayerA: SVGGElement;
  treeLayerB: SVGGElement;
  labelLayers: SVGGElement[];
  width: number;
  height: number;
}

interface RenderedSideScene {
  labelLayer: SVGGElement;
  connectionAnchorByNodeId: Map<string, { x: number; y: number }>;
}

type ConnectionEmphasis = 'default' | 'muted' | 'selected' | 'focused';
type NodeCompareEmphasis = 'none' | 'selected' | 'focused';

interface ConnectionStyle {
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
}

export function renderTanglegramSvg(
  svg: SVGSVGElement,
  input: TanglegramSceneInput
): TanglegramRenderedScene {
  const { layout, state, options } = input;
  const viewStateA = input.viewStateA ?? ViewState.empty();
  const viewStateB = input.viewStateB ?? ViewState.empty();
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('width', String(layout.width));
  svg.setAttribute('height', String(layout.height));

  const root = el('g');
  const connectionsLayer = el('g');
  const treeLayerA = el('g');
  const treeLayerB = el('g');
  const selectedNodeIds = buildSelectedNodeIds(layout, state);
  const compareNodeEmphasis = buildCompareNodeEmphasis(layout, state, selectedNodeIds);

  const renderedA = renderSide(
    treeLayerA,
    layout.sideA,
    viewStateA,
    options,
    'A',
    state,
    compareNodeEmphasis.A,
    options.showLabelsA,
    input.onNodeClick
  );
  const renderedB = renderSide(
    treeLayerB,
    layout.sideB,
    viewStateB,
    options,
    'B',
    state,
    compareNodeEmphasis.B,
    options.showLabelsB,
    input.onNodeClick
  );

  root.append(connectionsLayer, treeLayerA, treeLayerB);
  svg.appendChild(root);

  for (const [connectionIndex, connection] of layout.connections.entries()) {
    if (state.isConnectionHidden(connection.key)) {
      continue;
    }
    const highlightedBySelection = isConnectionHighlightedBySelection(connection, selectedNodeIds);
    const highlightedByFocus = state.focusedConnectionKey === connection.key;
    const emphasis = resolveConnectionEmphasis(
      highlightedBySelection,
      highlightedByFocus,
      state
    );
    if (!shouldRenderConnectionByVisibility(
      highlightedBySelection,
      highlightedByFocus,
      state,
      options.connectionVisibility
    )) {
      continue;
    }
    if (!shouldRenderConnection(
      connectionIndex,
      layout.connections.length,
      emphasis !== 'default' && emphasis !== 'muted',
      options.connectionDensity,
      options.connectionDensityStrideMultiplier
    )) {
      continue;
    }
    const start = renderedA.connectionAnchorByNodeId.get(connection.sideANodeId) ?? {
      x: connection.startX,
      y: connection.startY,
    };
    const end = renderedB.connectionAnchorByNodeId.get(connection.sideBNodeId) ?? {
      x: connection.endX,
      y: connection.endY,
    };
    const path = el('path');
    path.setAttribute('d', buildConnectionPath(start.x, start.y, end.x, end.y, options.connectionCurve));
    path.setAttribute('fill', 'none');
    applyConnectionStyle(path, getConnectionStyle(emphasis, options));
    path.setAttribute('data-connection-key', connection.key);
    path.addEventListener('mouseenter', () => {
      applyConnectionStyle(path, getHoveredConnectionStyle(emphasis, options));
    });
    path.addEventListener('mouseleave', () => {
      applyConnectionStyle(path, getConnectionStyle(emphasis, options));
    });
    if (input.onConnectionClick) {
      path.style.cursor = 'pointer';
      path.addEventListener('click', (event) => input.onConnectionClick?.({ connectionKey: connection.key }, event));
    }
    connectionsLayer.appendChild(path);
  }

  return {
    rootLayer: root,
    connectionsLayer,
    treeLayerA,
    treeLayerB,
    labelLayers: [
      treeLayerA.querySelector('g:last-child') ?? el('g'),
      treeLayerB.querySelector('g:last-child') ?? el('g'),
    ],
    width: layout.width,
    height: layout.height,
  };
}

function renderSide(
  layer: SVGGElement,
  side: TanglegramSideLayout,
  viewState: ViewState,
  options: TanglegramRenderOptions,
  sideName: 'A' | 'B',
  state: TanglegramState,
  compareNodeEmphasisById: Map<string, NodeCompareEmphasis>,
  showLabels: boolean,
  onNodeClick?: (payload: { side: TanglegramSide; nodeId: string }, event: MouseEvent) => void
): RenderedSideScene {
  const byId = new Map(side.nodes.map((node) => [node.node.id, node]));
  const selectedSubtreeNodeIds = state.selectedSide === sideName && state.selectedNodeId
    ? collectVisibleDescendantIds(state.selectedNodeId, byId)
    : new Set<string>();
  const lines = el('g');
  const markers = el('g');
  const nodes = el('g');
  const labels = el('g');
  const leafItems = side.nodes.filter((item) => item.node.children.length === 0);
  const alignedLabelPad = 84;
  const nodeEdgeOffset = Math.max(options.nodeSize, 3);
  const sideMinX = side.offsetX + 16;
  const sideMaxX = side.offsetX + side.width - 16;
  const desiredAlignedLabelX = side.mirror
    ? Math.min(...leafItems.map((item) => item.x - nodeEdgeOffset)) - alignedLabelPad
    : Math.max(...leafItems.map((item) => item.x + nodeEdgeOffset)) + alignedLabelPad;
  const alignedLabelX = side.mirror
    ? Math.max(sideMinX, desiredAlignedLabelX)
    : Math.min(sideMaxX, desiredAlignedLabelX);
  const alignTips = side.mirror ? options.alignTipsB : options.alignTipsA;
  const inlineLabelOffset = side.mirror ? -10 : 10;
  const labelAnchor = side.mirror ? 'end' : 'start';
  const leaderEndX = side.mirror ? alignedLabelX + 6 : alignedLabelX - 6;
  const lineByNodeId = new Map<string, SVGPathElement>();
  const markerByNodeId = new Map<string, SVGPolygonElement>();
  const circleByNodeId = new Map<string, SVGCircleElement>();
  const labelByNodeId = new Map<string, SVGTextElement>();
  const leaderByNodeId = new Map<string, SVGLineElement>();
  const connectionAnchorByNodeId = new Map<string, { x: number; y: number }>();
  const renderLabelForNodeId = computeRenderableLabelIds(
    side.nodes,
    state,
    sideName,
    options.labelSize,
    sideName === 'A' ? options.labelDensityA : options.labelDensityB,
    options.labelDensityGapMultiplier
  );

  for (const item of side.nodes) {
    if (!item.parentId) continue;
    const parent = byId.get(item.parentId);
    if (!parent) continue;
    const selected = state.selectedSide === sideName && state.selectedNodeId === item.node.id;
    const inSelectedSubtree = selectedSubtreeNodeIds.has(item.node.id);
    const compareEmphasis = compareNodeEmphasisById.get(item.node.id) ?? 'none';
    const path = el('path');
    path.setAttribute('d', `M${parent.x},${parent.y} V${item.y} H${item.x}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', resolveNodeBranchStroke(item.node.id, selected, inSelectedSubtree, compareEmphasis, viewState, options));
    path.setAttribute('stroke-width', String(resolveNodeBranchWidth(selected, inSelectedSubtree, compareEmphasis, options)));
    lines.appendChild(path);
    lineByNodeId.set(item.node.id, path);
  }

  for (const item of side.nodes) {
    const selected = state.selectedSide === sideName && state.selectedNodeId === item.node.id;
    const circle = el('circle');
    circle.setAttribute('cx', String(item.x));
    circle.setAttribute('cy', String(item.y));
    circle.setAttribute('r', String(
      selected
        ? options.nodeSize + 1.5
        : options.nodeSize
    ));
    circle.setAttribute('fill', resolveNodeColor(item.node.id, viewState, options.nodeColor));
    circle.setAttribute('data-side', sideName);
    circle.setAttribute('data-node-id', item.node.id);
    if (selected) {
      circle.setAttribute('stroke', '#ef476f');
      circle.setAttribute('stroke-width', '2');
    }
    if (onNodeClick) {
      circle.style.cursor = 'pointer';
      circle.addEventListener('click', (event) => onNodeClick({ side: sideName, nodeId: item.node.id }, event));
    }
    nodes.appendChild(circle);
    circleByNodeId.set(item.node.id, circle);

    if (item.collapsed) {
      const marker = el('polygon');
      marker.setAttribute('points', buildCollapseMarker(item, options.nodeSize + 5, side.mirror));
      marker.setAttribute('fill', selected ? '#ef476f' : resolveNodeColor(item.node.id, viewState, options.nodeColor));
      marker.setAttribute('fill-opacity', '0.18');
      marker.setAttribute('stroke', selected ? '#ef476f' : resolveNodeColor(item.node.id, viewState, options.nodeColor));
      marker.setAttribute('stroke-width', String(selected ? Math.max(2, options.branchWidth + 1) : Math.max(1, options.branchWidth)));
      marker.setAttribute('data-side', sideName);
      marker.setAttribute('data-node-id', item.node.id);
      if (onNodeClick) {
        marker.style.cursor = 'pointer';
        marker.addEventListener('click', (event) => onNodeClick({ side: sideName, nodeId: item.node.id }, event));
      }
      markers.appendChild(marker);
      markerByNodeId.set(item.node.id, marker);
    }

    const isLeaf = item.node.children.length === 0;
    const useAlignedTips = alignTips && isLeaf;
    const shouldRenderLabel = showLabels && !!item.node.name && renderLabelForNodeId.has(item.node.id);

    if (!shouldRenderLabel) {
      connectionAnchorByNodeId.set(item.node.id, {
        x: item.x + (side.mirror ? -nodeEdgeOffset : nodeEdgeOffset),
        y: item.y,
      });
      continue;
    }

    const text = el('text');
    text.textContent = item.node.name;
    const labelX = useAlignedTips
      ? alignedLabelX
      : item.x + inlineLabelOffset;
    text.setAttribute('x', String(labelX));
    text.setAttribute('y', String(item.y + 4));
    text.setAttribute('text-anchor', labelAnchor);
    text.setAttribute('font-size', String(options.labelSize));
    text.setAttribute('fill', selected ? '#ef476f' : options.labelColor);
    if (selected) {
      text.setAttribute('font-weight', '700');
    }
    if (onNodeClick) {
      text.style.cursor = 'pointer';
      text.addEventListener('click', (event) => onNodeClick({ side: sideName, nodeId: item.node.id }, event));
    }

    if (useAlignedTips) {
      const leader = el('line');
      const leaderStartX = item.x + (side.mirror ? -nodeEdgeOffset : nodeEdgeOffset);
      leader.setAttribute('x1', String(leaderStartX));
      leader.setAttribute('y1', String(item.y));
      leader.setAttribute('x2', String(leaderEndX));
      leader.setAttribute('y2', String(item.y));
      leader.setAttribute('stroke', selected ? '#ef476f' : options.branchColor);
      leader.setAttribute('stroke-opacity', '0.45');
      leader.setAttribute('stroke-width', String(Math.max(0.6, options.branchWidth * 0.7)));
      leader.setAttribute('stroke-dasharray', '4 2');
      labels.appendChild(leader);
      leaderByNodeId.set(item.node.id, leader);

      const textWidth = estimateLabelWidth(item.node.name, options.labelSize);
      const anchorX = side.mirror
        ? labelX - textWidth - 4
        : labelX + textWidth + 4;
      connectionAnchorByNodeId.set(item.node.id, {
        x: anchorX,
        y: item.y,
      });
    } else {
      connectionAnchorByNodeId.set(item.node.id, {
        x: item.x + (side.mirror ? -nodeEdgeOffset : nodeEdgeOffset),
        y: item.y,
      });
    }

    labels.appendChild(text);
    labelByNodeId.set(item.node.id, text);
  }

  for (const item of side.nodes) {
    const selected = state.selectedSide === sideName && state.selectedNodeId === item.node.id;
    const inSelectedSubtree = selectedSubtreeNodeIds.has(item.node.id);
    const compareEmphasis = compareNodeEmphasisById.get(item.node.id) ?? 'none';
    const circle = circleByNodeId.get(item.node.id);
    const label = labelByNodeId.get(item.node.id);
    const leader = leaderByNodeId.get(item.node.id);
    const line = lineByNodeId.get(item.node.id);
    const marker = markerByNodeId.get(item.node.id);
    const baseCircleFill = resolveNodeColor(item.node.id, viewState, options.nodeColor);
    const baseLineStroke = resolveNodeBranchStroke(item.node.id, selected, inSelectedSubtree, compareEmphasis, viewState, options);
    const baseLineWidth = resolveNodeBranchWidth(selected, inSelectedSubtree, compareEmphasis, options);
    const baseLabelFill = selected ? '#ef476f' : options.labelColor;
    const baseMarkerStroke = selected ? '#ef476f' : resolveNodeColor(item.node.id, viewState, options.nodeColor);
    const baseMarkerFill = baseMarkerStroke;

    const applyHover = (hovered: boolean) => {
      if (circle) {
        circle.setAttribute(
          'r',
          String(
            hovered
              ? options.nodeSize + 2.5
              : selected
                ? options.nodeSize + 1.5
                : options.nodeSize
          )
        );
        circle.setAttribute('stroke', hovered || selected ? '#f4a261' : '');
        circle.setAttribute('stroke-width', hovered || selected ? '2' : '0');
        circle.setAttribute('fill', baseCircleFill);
      }
      if (line) {
        line.setAttribute('stroke', hovered ? '#f4a261' : baseLineStroke);
        line.setAttribute(
          'stroke-width',
          String(hovered ? Math.max(baseLineWidth + 1.2, options.branchWidth * 2) : baseLineWidth)
        );
      }
      if (label) {
        label.setAttribute('fill', hovered ? '#f4a261' : baseLabelFill);
        label.setAttribute('font-weight', hovered || selected ? '700' : '400');
      }
      if (leader) {
        leader.setAttribute('stroke', hovered ? '#f4a261' : baseLineStroke);
        leader.setAttribute(
          'stroke-width',
          String(hovered ? Math.max(baseLineWidth * 0.9, options.branchWidth + 0.6) : Math.max(0.6, options.branchWidth * 0.7))
        );
      }
      if (marker) {
        marker.setAttribute('stroke', hovered ? '#f4a261' : baseMarkerStroke);
        marker.setAttribute('fill', hovered ? '#f4a261' : baseMarkerFill);
        marker.setAttribute('fill-opacity', hovered ? '0.28' : '0.18');
      }
    };

    const bindHover = (element: SVGElement | undefined) => {
      if (!element) return;
      element.addEventListener('mouseenter', () => applyHover(true));
      element.addEventListener('mouseleave', () => applyHover(false));
    };

    bindHover(circle);
    bindHover(marker);
    bindHover(label);
    bindHover(leader);
  }

  layer.append(lines, markers, nodes, labels);

  return {
    labelLayer: labels,
    connectionAnchorByNodeId,
  };
}

function resolveBranchColor(nodeId: string, viewState: ViewState, defaultColor: string): string {
  return viewState.getColor(nodeId) ?? defaultColor;
}

function resolveNodeColor(nodeId: string, viewState: ViewState, defaultColor: string): string {
  return viewState.getColor(nodeId) ?? defaultColor;
}

function resolveNodeBranchStroke(
  nodeId: string,
  selected: boolean,
  inSelectedSubtree: boolean,
  compareEmphasis: NodeCompareEmphasis,
  viewState: ViewState,
  options: TanglegramRenderOptions
): string {
  if (selected || inSelectedSubtree || compareEmphasis === 'focused' || compareEmphasis === 'selected') {
    return '#ef476f';
  }
  return resolveBranchColor(nodeId, viewState, options.branchColor);
}

function resolveNodeBranchWidth(
  selected: boolean,
  inSelectedSubtree: boolean,
  compareEmphasis: NodeCompareEmphasis,
  options: TanglegramRenderOptions
): number {
  if (selected || compareEmphasis === 'focused') {
    return Math.max(options.branchWidth * 1.9, options.branchWidth + 1.1);
  }
  if (inSelectedSubtree) {
    return Math.max(options.branchWidth * 1.45, options.branchWidth + 0.45);
  }
  if (compareEmphasis === 'selected') {
    return Math.max(options.branchWidth * 1.45, options.branchWidth + 0.5);
  }
  return options.branchWidth;
}

function buildConnectionPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  curve: number
): string {
  const normalizedCurve = Number.isFinite(curve) ? Math.min(1, Math.max(0, curve)) : 0.35;
  const controlOffset = Math.max(8, Math.abs(endX - startX) * normalizedCurve);
  const c1x = startX + controlOffset;
  const c2x = endX - controlOffset;
  return `M${startX},${startY} C${c1x},${startY} ${c2x},${endY} ${endX},${endY}`;
}

function estimateLabelWidth(label: string | null | undefined, fontSize: number): number {
  if (!label) {
    return 0;
  }
  return Math.max(fontSize * 0.65, label.length * fontSize * 0.62);
}

function computeRenderableLabelIds(
  nodes: PositionedNode[],
  state: TanglegramState,
  sideName: 'A' | 'B',
  labelSize: number,
  densityMode: TanglegramLabelDensityMode,
  gapMultiplier: number
): Set<string> {
  const namedNodes = [...nodes]
    .filter((item) => !!item.node.name)
    .sort((left, right) => left.y - right.y);

  if (densityMode === 'all') {
    return new Set(namedNodes.map((item) => item.node.id));
  }

  const result = new Set<string>();
  const normalizedGapMultiplier = Number.isFinite(gapMultiplier) ? Math.max(0.5, gapMultiplier) : 1;
  const densityMultiplier = densityMode === 'sparse' ? 1.8 : 1;
  const minGap = Math.max(labelSize * 0.95 * normalizedGapMultiplier * densityMultiplier, 12 * densityMultiplier);
  let lastAcceptedY = Number.NEGATIVE_INFINITY;

  for (const item of namedNodes) {
    const selected = state.selectedSide === sideName && state.selectedNodeId === item.node.id;
    if (selected || item.y - lastAcceptedY >= minGap) {
      result.add(item.node.id);
      lastAcceptedY = item.y;
    }
  }

  return result;
}

function isConnectionHighlightedBySelection(
  connection: TanglegramLayout['connections'][number],
  selectedNodeIds: Record<TanglegramSide, Set<string>>
): boolean {
  return selectedNodeIds.A.has(connection.sideANodeId) || selectedNodeIds.B.has(connection.sideBNodeId);
}

function buildCollapseMarker(item: PositionedNode, size: number, mirror: boolean): string {
  const half = Math.max(3, size);
  const tipX = item.x;
  const tipY = item.y;
  const baseOffset = half * 1.35;
  const direction = mirror ? -1 : 1;
  const baseX = item.x + direction * baseOffset;
  const points = [
    `${tipX},${tipY}`,
    `${baseX},${item.y - half}`,
    `${baseX},${item.y + half}`,
  ];
  return points.join(' ');
}

function collectVisibleDescendantIds(
  nodeId: string,
  byId: Map<string, PositionedNode>
): Set<string> {
  const start = byId.get(nodeId);
  if (!start) {
    return new Set();
  }

  const out = new Set<string>();
  const stack: PositionedNode[] = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    out.add(current.node.id);
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

function applyConnectionStyle(path: SVGPathElement, style: ConnectionStyle): void {
  path.setAttribute('stroke', style.stroke);
  path.setAttribute('stroke-width', String(style.strokeWidth));
  path.setAttribute('stroke-opacity', String(style.strokeOpacity));
}

function resolveConnectionEmphasis(
  highlightedBySelection: boolean,
  highlightedByFocus: boolean,
  state: TanglegramState
): ConnectionEmphasis {
  if (highlightedByFocus) {
    return 'focused';
  }
  if (highlightedBySelection) {
    return 'selected';
  }
  if (state.focusedConnectionKey || (state.selectedSide && state.selectedNodeId)) {
    return 'muted';
  }
  return 'default';
}

function buildCompareNodeEmphasis(
  layout: TanglegramLayout,
  state: TanglegramState,
  selectedNodeIds: Record<TanglegramSide, Set<string>>
): Record<TanglegramSide, Map<string, NodeCompareEmphasis>> {
  const emphasis = {
    A: new Map<string, NodeCompareEmphasis>(),
    B: new Map<string, NodeCompareEmphasis>(),
  };
  const byId = {
    A: layout.sideA.nodeById,
    B: layout.sideB.nodeById,
  };
  const directHits = {
    A: new Map<string, NodeCompareEmphasis>(),
    B: new Map<string, NodeCompareEmphasis>(),
  };

  for (const connection of layout.connections) {
    if (state.isConnectionHidden(connection.key)) {
      continue;
    }

    const highlightedBySelection = isConnectionHighlightedBySelection(connection, selectedNodeIds);
    const highlightedByFocus = state.focusedConnectionKey === connection.key;

    if (!highlightedBySelection && !highlightedByFocus) {
      continue;
    }

    const nodeEmphasis: NodeCompareEmphasis = highlightedByFocus ? 'focused' : 'selected';
    mergeNodeCompareEmphasis(directHits.A, connection.sideANodeId, nodeEmphasis);
    mergeNodeCompareEmphasis(directHits.B, connection.sideBNodeId, nodeEmphasis);
  }

  for (const side of ['A', 'B'] as const) {
    const expandedIds = collectAncestorClosure(directHits[side], byId[side]);
    for (const [nodeId, nodeEmphasis] of expandedIds.entries()) {
      mergeNodeCompareEmphasis(emphasis[side], nodeId, nodeEmphasis);
    }
  }

  return emphasis;
}

function buildSelectedNodeIds(
  layout: TanglegramLayout,
  state: TanglegramState
): Record<TanglegramSide, Set<string>> {
  const selected = {
    A: new Set<string>(),
    B: new Set<string>(),
  };

  if (!state.selectedSide || !state.selectedNodeId) {
    return selected;
  }

  const byId = state.selectedSide === 'A' ? layout.sideA.nodeById : layout.sideB.nodeById;
  selected[state.selectedSide] = collectVisibleDescendantIds(state.selectedNodeId, byId);
  return selected;
}

function collectAncestorClosure(
  source: Map<string, NodeCompareEmphasis>,
  byId: Map<string, PositionedNode>
): Map<string, NodeCompareEmphasis> {
  const expanded = new Map<string, NodeCompareEmphasis>();

  for (const [nodeId, emphasis] of source.entries()) {
    let current = byId.get(nodeId);
    while (current) {
      mergeNodeCompareEmphasis(expanded, current.node.id, emphasis);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }

  return expanded;
}

function mergeNodeCompareEmphasis(
  target: Map<string, NodeCompareEmphasis>,
  nodeId: string,
  next: NodeCompareEmphasis
): void {
  const current = target.get(nodeId) ?? 'none';
  if (current === 'focused' || current === next) {
    return;
  }
  if (next === 'focused' || current === 'none') {
    target.set(nodeId, next);
  }
}

function getConnectionStyle(
  emphasis: ConnectionEmphasis,
  options: TanglegramRenderOptions
): ConnectionStyle {
  switch (emphasis) {
    case 'focused':
      return {
        stroke: '#ef476f',
        strokeWidth: Math.max(options.connectionWidth * 2.4, options.connectionWidth + 1.8),
        strokeOpacity: 1,
      };
    case 'selected':
      return {
        stroke: '#f28482',
        strokeWidth: Math.max(options.connectionWidth * 1.8, options.connectionWidth + 1),
        strokeOpacity: Math.max(0.92, options.connectionOpacity),
      };
    case 'muted':
      return {
        stroke: options.connectionColor,
        strokeWidth: Math.max(0.8, options.connectionWidth * 0.9),
        strokeOpacity: Math.max(0.08, options.connectionOpacity * 0.22),
      };
    default:
      return {
        stroke: options.connectionColor,
        strokeWidth: options.connectionWidth,
        strokeOpacity: options.connectionOpacity,
      };
  }
}

function getHoveredConnectionStyle(
  emphasis: ConnectionEmphasis,
  options: TanglegramRenderOptions
): ConnectionStyle {
  const base = getConnectionStyle(emphasis, options);
  return {
    stroke: emphasis === 'focused' ? '#ff7b89' : '#f4a261',
    strokeWidth: Math.max(base.strokeWidth + 0.9, options.connectionWidth + 1.2),
    strokeOpacity: 1,
  };
}

function el<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}


function shouldRenderConnection(
  index: number,
  total: number,
  highlighted: boolean,
  densityMode: TanglegramConnectionDensityMode,
  strideMultiplier: number
): boolean {
  if (highlighted || densityMode === 'all' || total <= 0) {
    return true;
  }

  const normalizedStrideMultiplier = Number.isFinite(strideMultiplier) ? Math.max(1, strideMultiplier) : 1;
  const targetVisible = densityMode === 'sparse' ? 14 : 28;
  const baseStride = Math.max(1, Math.ceil(total / targetVisible));
  const stride = Math.max(1, Math.round(baseStride * normalizedStrideMultiplier));
  return index % stride === 0;
}


function shouldRenderConnectionByVisibility(
  highlightedBySelection: boolean,
  highlightedByFocus: boolean,
  state: TanglegramState,
  visibilityMode: TanglegramConnectionVisibilityMode
): boolean {
  if (visibilityMode === 'all') {
    return true;
  }

  if (visibilityMode === 'focus') {
    if (!state.focusedConnectionKey) {
      return true;
    }
    return highlightedByFocus;
  }

  if (!state.selectedSide || !state.selectedNodeId) {
    return !state.focusedConnectionKey || highlightedByFocus;
  }

  return highlightedBySelection || highlightedByFocus;
}
