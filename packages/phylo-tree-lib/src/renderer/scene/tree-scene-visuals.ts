import type { TreeRenderOptions } from '../render-options';
import type { BuiltScene } from './tree-scene';

export function applyBuiltSceneVisualUpdates(
  scene: BuiltScene,
  options: TreeRenderOptions
): void {
  for (const line of scene.lineElements) {
    line.setAttribute('stroke', options.branchColor);
    line.setAttribute('stroke-width', String(options.branchWidth));
  }

  for (const leader of scene.leaderElements) {
    leader.setAttribute('stroke', options.branchColor);
    leader.setAttribute('stroke-width', String(Math.max(0.6, options.branchWidth * 0.7)));
  }

  for (const node of scene.nodeElements) {
    node.setAttribute('fill', options.nodeColor);
    node.setAttribute('r', String(options.nodeSize));
  }

  for (const marker of scene.collapseMarkerById.values()) {
    marker.setAttribute('fill', options.nodeColor);
    marker.setAttribute('stroke', options.nodeColor);
    marker.setAttribute('stroke-width', String(Math.max(1, options.branchWidth)));
  }

  for (const label of scene.labelElements) {
    label.setAttribute('font-size', String(options.labelSize));
    if (!options.showLabels) {
      label.style.opacity = '0';
      label.style.pointerEvents = 'none';
    } else if (label.style.opacity === '0') {
      label.style.opacity = '1';
      label.style.pointerEvents = '';
    }
  }
}
