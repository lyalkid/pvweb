import { ViewState } from '../../tree/ViewState';
import type { TreeRenderOptions } from '../render-options';
import type { PositionedNode } from '../core/types';
import { buildTreeSceneModel } from './tree-scene-model';
import { buildMountedSceneFromModel } from './tree-scene-mount';
import { attachSceneHoverInteractions } from './tree-scene-hover-layer';
import { applyBuiltSceneViewState } from './tree-scene-state';
import { applyBuiltSceneVisualUpdates } from './tree-scene-visuals';

export interface BuiltScene {
  lines: SVGGElement;
  nodes: SVGGElement;
  markers: SVGGElement;
  overlays: SVGGElement;
  labels: SVGGElement;
  lineElements: SVGElement[];
  leaderElements: SVGLineElement[];
  nodeElements: SVGCircleElement[];
  collapseMarkerById: Map<string, SVGPolygonElement>;
  labelElements: SVGTextElement[];
  parentById: Map<string, string | null>;
  nodeById: Map<string, SVGCircleElement>;
  hoverTooltip: SVGGElement;
  hoverTooltipText: SVGTextElement;
  lineByChildId: Map<string, SVGElement>;
  leaderByNodeId: Map<string, SVGLineElement>;
  labelById: Map<string, SVGTextElement>;
}

export interface SceneBuildOptions {
  enableTransitions: boolean;
  renderLabels: boolean;
}

export function buildScene(
  items: PositionedNode[],
  cfg: TreeRenderOptions,
  onNodeClick: (nodeId: string, e: MouseEvent) => void,
  onNodeHover: (nodeId: string | null, e: MouseEvent) => void,
  options: SceneBuildOptions
): BuiltScene {
  const model = buildTreeSceneModel(items, cfg, options);
  const scene = buildMountedSceneFromModel(items, model, cfg, options);

  scene.nodes.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof SVGCircleElement)) return;
    const nodeId = target.getAttribute('data-node-id');
    if (!nodeId) return;
    e.stopPropagation();
    onNodeClick(nodeId, e);
  });

  attachSceneHoverInteractions({ scene, items, cfg, onNodeHover });

  return scene;
}

export function mountScene(rootLayer: SVGGElement, scene: BuiltScene): void {
  rootLayer.append(scene.lines, scene.markers, scene.overlays, scene.nodes, scene.labels);
}

export function applySceneVisualUpdates(scene: BuiltScene, options: TreeRenderOptions): void {
  applyBuiltSceneVisualUpdates(scene, options);
}

export function applySceneViewState(
  scene: BuiltScene,
  viewState: ViewState,
  options: TreeRenderOptions
): void {
  applyBuiltSceneViewState(scene, viewState, options);
}
