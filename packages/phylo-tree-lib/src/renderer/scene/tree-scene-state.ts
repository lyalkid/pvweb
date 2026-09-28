import { ViewState } from '../../tree/ViewState';
import type { TreeRenderOptions } from '../render-options';
import type { BuiltScene } from './tree-scene';
import {
  buildBuiltSceneStateModel,
  type BuiltSceneElementState,
} from './tree-scene-state-model';

export function applyBuiltSceneViewState(
  scene: BuiltScene,
  viewState: ViewState,
  options: TreeRenderOptions
): void {
  const stateModel = buildBuiltSceneStateModel(viewState, scene.parentById, options);

  for (const [nodeId, nodeEl] of scene.nodeById.entries()) {
    applyBuiltSceneElementState(nodeEl, stateModel.nodeElementsById.get(nodeId));
  }

  for (const [nodeId, markerEl] of scene.collapseMarkerById.entries()) {
    applyBuiltSceneElementState(markerEl, stateModel.collapseMarkerElementsById.get(nodeId));
  }

  for (const [nodeId, labelEl] of scene.labelById.entries()) {
    applyBuiltSceneElementState(labelEl, stateModel.labelElementsById.get(nodeId));
  }

  for (const [nodeId, leaderEl] of scene.leaderByNodeId.entries()) {
    applyBuiltSceneElementState(leaderEl, stateModel.leaderElementsByNodeId.get(nodeId));
  }

  for (const [childId, lineEl] of scene.lineByChildId.entries()) {
    applyBuiltSceneElementState(lineEl, stateModel.lineElementsByChildId.get(childId));
  }
}

function applyBuiltSceneElementState(
  element: SVGElement,
  state: BuiltSceneElementState | undefined
): void {
  if (!state) {
    return;
  }
  if (state.opacity !== undefined) {
    element.style.opacity = state.opacity;
  }
  if (state.pointerEvents !== undefined) {
    element.style.pointerEvents = state.pointerEvents;
  }
  if (state.fill !== undefined) {
    element.setAttribute('fill', state.fill);
  }
  if (state.stroke !== undefined) {
    element.setAttribute('stroke', state.stroke);
  }
}
