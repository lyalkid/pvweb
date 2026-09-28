import type { PhyloTree } from '../../tree/types';
import type { TreeRenderOptions } from '../render-options';
import type { BuiltScene } from '../scene/tree-scene';
import type { ViewTransform } from '../core/types';

export function getTreeLeafCount(currentTree: PhyloTree | null): number {
  return currentTree?.metadata.leafCount ?? 0;
}

export function getSvgClientPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const matrix = svg.getScreenCTM();
  if (!matrix) {
    return { x: clientX, y: clientY };
  }

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  return point.matrixTransform(matrix.inverse());
}

export function shouldUseInteractionMode(
  leafCount: number,
  activeOptions: TreeRenderOptions,
  denseLeafThreshold: number
): boolean {
  if (!activeOptions.showLabels) {
    return false;
  }

  return leafCount >= denseLeafThreshold;
}

export function getTreeLabelLayer(scene: BuiltScene | null): SVGGElement | null {
  return scene?.labels ?? null;
}

export function computeWheelTransform(
  transform: ViewTransform,
  pointerX: number,
  pointerY: number,
  deltaY: number,
  minZoom: number,
  maxZoom: number
): ViewTransform {
  const worldX = (pointerX - transform.x) / transform.k;
  const worldY = (pointerY - transform.y) / transform.k;
  const factor = Math.exp(-deltaY * 0.0015);
  const nextK = clamp(transform.k * factor, minZoom, maxZoom);

  return {
    x: pointerX - worldX * nextK,
    y: pointerY - worldY * nextK,
    k: nextK,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
