import type { PositionedNode } from '../core/types';
import type { TreeRenderOptions } from '../render-options';
import { setTransition } from './tree-scene-geometry';
import { createSceneHoverTooltip } from './tree-scene-hover-layer';
import type { TreeSceneModel } from './tree-scene-model';
import type { BuiltScene, SceneBuildOptions } from './tree-scene';

export function buildMountedSceneFromModel(
  items: PositionedNode[],
  model: TreeSceneModel,
  cfg: TreeRenderOptions,
  options: SceneBuildOptions
): BuiltScene {
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const nodes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const markers = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const overlays = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const labels = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  lines.style.pointerEvents = 'none';
  markers.style.pointerEvents = 'none';
  overlays.style.pointerEvents = 'none';
  labels.style.pointerEvents = 'none';

  const lineElements: SVGElement[] = [];
  const leaderElements: SVGLineElement[] = [];
  const nodeElements: SVGCircleElement[] = [];
  const collapseMarkerById = new Map<string, SVGPolygonElement>();
  const labelElements: SVGTextElement[] = [];
  const parentById = model.parentById;
  const nodeById = new Map<string, SVGCircleElement>();
  const lineByChildId = new Map<string, SVGElement>();
  const leaderByNodeId = new Map<string, SVGLineElement>();
  const labelById = new Map<string, SVGTextElement>();
  const { hoverTooltip, hoverTooltipText } = createSceneHoverTooltip();
  overlays.append(hoverTooltip);

  for (const lineModel of model.lines) {
    if (lineModel.kind === 'path') {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', lineModel.d ?? '');
      path.setAttribute('fill', 'none');
      path.setAttribute('data-child-id', lineModel.childId);
      path.setAttribute('stroke', cfg.branchColor);
      path.setAttribute('stroke-width', String(cfg.branchWidth));
      setTransition(path, options.enableTransitions, 'opacity 200ms ease, stroke 200ms ease, stroke-width 200ms ease');
      lines.appendChild(path);
      lineElements.push(path);
      lineByChildId.set(lineModel.childId, path);
    } else {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(lineModel.x1 ?? 0));
      line.setAttribute('y1', String(lineModel.y1 ?? 0));
      line.setAttribute('x2', String(lineModel.x2 ?? 0));
      line.setAttribute('y2', String(lineModel.y2 ?? 0));
      line.setAttribute('data-child-id', lineModel.childId);
      line.setAttribute('stroke', cfg.branchColor);
      line.setAttribute('stroke-width', String(cfg.branchWidth));
      setTransition(line, options.enableTransitions, 'opacity 200ms ease, stroke 200ms ease, stroke-width 200ms ease');
      lines.appendChild(line);
      lineElements.push(line);
      lineByChildId.set(lineModel.childId, line);
    }
  }

  for (const item of items) {
    const nodeModel = model.nodes.find((node) => node.nodeId === item.node.id);
    if (!nodeModel) continue;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(nodeModel.x));
    circle.setAttribute('cy', String(nodeModel.y));
    circle.setAttribute('r', String(nodeModel.radius));
    circle.setAttribute('fill', cfg.nodeColor);
    circle.setAttribute('data-node-id', item.node.id);
    circle.style.cursor = 'pointer';
    setTransition(circle, options.enableTransitions, 'opacity 200ms ease, fill 200ms ease, r 200ms ease');
    nodes.appendChild(circle);
    nodeElements.push(circle);
    nodeById.set(item.node.id, circle);

    const markerModel = model.markers.find((marker) => marker.nodeId === item.node.id);
    if (markerModel) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      marker.setAttribute('points', markerModel.points);
      marker.setAttribute('fill', cfg.nodeColor);
      marker.setAttribute('fill-opacity', '0.18');
      marker.setAttribute('stroke', cfg.nodeColor);
      marker.setAttribute('stroke-width', String(Math.max(1, cfg.branchWidth)));
      marker.setAttribute('data-node-id', item.node.id);
      setTransition(
        marker,
        options.enableTransitions,
        'opacity 200ms ease, fill 200ms ease, stroke 200ms ease, stroke-width 200ms ease'
      );
      markers.appendChild(marker);
      collapseMarkerById.set(item.node.id, marker);
    }

    for (const leaderModel of model.leaders.filter((leader) => leader.nodeId === item.node.id)) {
      const leader = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      leader.setAttribute('x1', String(leaderModel.x1));
      leader.setAttribute('y1', String(leaderModel.y1));
      leader.setAttribute('x2', String(leaderModel.x2));
      leader.setAttribute('y2', String(leaderModel.y2));
      leader.setAttribute('stroke', cfg.branchColor);
      leader.setAttribute('stroke-opacity', '0.45');
      leader.setAttribute('stroke-width', String(Math.max(0.6, cfg.branchWidth * 0.7)));
      leader.setAttribute('stroke-dasharray', '4 2');
      setTransition(leader, options.enableTransitions, 'opacity 200ms ease, stroke 200ms ease, stroke-width 200ms ease');
      labels.appendChild(leader);
      leaderElements.push(leader);
      leaderByNodeId.set(item.node.id, leader);
    }

    const labelModel = model.labels.find((label) => label.nodeId === item.node.id);
    if (labelModel) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(labelModel.x));
      text.setAttribute('y', String(labelModel.y));
      if (labelModel.dy) {
        text.setAttribute('dy', labelModel.dy);
      }
      if (labelModel.textAnchor) {
        text.setAttribute('text-anchor', labelModel.textAnchor);
      }
      if (labelModel.transform) {
        text.setAttribute('transform', labelModel.transform);
      }
      text.setAttribute('font-size', String(cfg.labelSize));
      text.setAttribute('data-node-id', item.node.id);
      text.textContent = labelModel.text;
      setTransition(text, options.enableTransitions, 'opacity 200ms ease, font-size 200ms ease');
      labels.appendChild(text);
      labelElements.push(text);
      labelById.set(item.node.id, text);
    }
  }

  return {
    lines,
    nodes,
    markers,
    overlays,
    labels,
    lineElements,
    leaderElements,
    nodeElements,
    collapseMarkerById,
    labelElements,
    parentById,
    nodeById,
    hoverTooltip,
    hoverTooltipText,
    lineByChildId,
    leaderByNodeId,
    labelById,
  };
}
