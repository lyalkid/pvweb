import type { PositionedNode } from '../core/types';
import type { TreeRenderOptions } from '../render-options';
import { buildTooltipText, collectVisibleDescendantIds } from './tree-scene-hover';
import type { BuiltScene } from './tree-scene';

interface AttachSceneHoverInteractionsInput {
  scene: BuiltScene;
  items: PositionedNode[];
  cfg: TreeRenderOptions;
  onNodeHover: (nodeId: string | null, e: MouseEvent) => void;
}

interface HoverRestoreEntry {
  element: SVGElement;
  previousAttrs: Map<string, string | null>;
}

export function createSceneHoverTooltip(): {
  hoverTooltip: SVGGElement;
  hoverTooltipText: SVGTextElement;
} {
  const hoverTooltip = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const hoverTooltipBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  hoverTooltipBg.setAttribute('rx', '6');
  hoverTooltipBg.setAttribute('ry', '6');
  hoverTooltipBg.setAttribute('fill', '#203247');
  hoverTooltipBg.setAttribute('fill-opacity', '0.92');

  const hoverTooltipText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  hoverTooltipText.setAttribute('fill', '#ffffff');
  hoverTooltipText.setAttribute('font-size', '12');
  hoverTooltipText.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
  hoverTooltipText.setAttribute('x', '8');
  hoverTooltipText.setAttribute('y', '16');

  hoverTooltip.style.opacity = '0';
  hoverTooltip.append(hoverTooltipBg, hoverTooltipText);

  return { hoverTooltip, hoverTooltipText };
}

export function attachSceneHoverInteractions({
  scene,
  items,
  cfg,
  onNodeHover,
}: AttachSceneHoverInteractionsInput): void {
  const byId = new Map(items.map((item) => [item.node.id, item]));
  let hoveredNodeId: string | null = null;
  let restoreEntries = new Map<SVGElement, HoverRestoreEntry>();

  function restoreHoverTarget(nodeId: string | null): void {
    if (!nodeId) return;
    restoreHoverEntries(restoreEntries);
    restoreEntries = new Map();
  }

  function applyHoverTarget(nodeId: string): void {
    const circle = scene.nodeById.get(nodeId);
    const line = scene.lineByChildId.get(nodeId);
    const label = scene.labelById.get(nodeId);
    const marker = scene.collapseMarkerById.get(nodeId);
    const descendantIds = collectVisibleDescendantIds(nodeId, byId);

    pushHoverEntry(restoreEntries, applyHoverAttrs(circle, {
      r: String(cfg.nodeSize + 1.5),
      stroke: '#f4a261',
      'stroke-width': '2',
    }));
    pushHoverEntry(restoreEntries, applyHoverAttrs(line, {
      stroke: '#f4a261',
      'stroke-width': String(Math.max(cfg.branchWidth * 1.8, cfg.branchWidth + 1)),
    }));
    pushHoverEntry(restoreEntries, applyHoverAttrs(label, {
      fill: '#f4a261',
      'font-weight': '700',
    }));
    pushHoverEntry(restoreEntries, applyHoverAttrs(marker, {
      fill: '#f4a261',
      stroke: '#f4a261',
      'fill-opacity': '0.28',
      'stroke-width': String(Math.max(2, cfg.branchWidth + 1)),
    }));

    for (const descendantId of descendantIds) {
      if (descendantId === nodeId) {
        continue;
      }
      const descendantLine = scene.lineByChildId.get(descendantId);
      pushHoverEntry(restoreEntries, applyHoverAttrs(descendantLine, {
        stroke: '#f4a261',
        'stroke-width': String(Math.max(cfg.branchWidth * 1.8, cfg.branchWidth + 1)),
      }));
    }
  }

  function updateTooltip(nodeId: string): void {
    const item = byId.get(nodeId);
    if (!item) {
      return;
    }
    const tooltipText = buildTooltipText(item, byId);
    scene.hoverTooltipText.textContent = tooltipText;
    const tooltipWidth = Math.max(60, tooltipText.length * 6.4 + 16);
    const tooltipBg = scene.hoverTooltip.firstElementChild;
    if (tooltipBg instanceof SVGRectElement) {
      tooltipBg.setAttribute('width', String(tooltipWidth));
      tooltipBg.setAttribute('height', '24');
    }
    const tooltipX = item.x + 12;
    const tooltipY = item.y - 30;
    scene.hoverTooltip.setAttribute('transform', `translate(${tooltipX},${tooltipY})`);
    scene.hoverTooltip.style.opacity = '1';
  }

  for (const [nodeId, circle] of scene.nodeById.entries()) {
    circle.addEventListener('mouseenter', (e) => {
      if (e.buttons !== 0) {
        restoreHoverTarget(hoveredNodeId);
        hoveredNodeId = null;
        scene.hoverTooltip.style.opacity = '0';
        onNodeHover(null, e);
        return;
      }
      if (hoveredNodeId !== nodeId) {
        restoreHoverTarget(hoveredNodeId);
        hoveredNodeId = nodeId;
        applyHoverTarget(nodeId);
      }
      updateTooltip(nodeId);
      onNodeHover(nodeId, e);
    });

    circle.addEventListener('mousemove', (e) => {
      if (e.buttons !== 0) {
        restoreHoverTarget(hoveredNodeId);
        hoveredNodeId = null;
        scene.hoverTooltip.style.opacity = '0';
        onNodeHover(null, e);
        return;
      }
      if (hoveredNodeId === nodeId) {
        updateTooltip(nodeId);
      }
    });

    circle.addEventListener('mouseleave', (e) => {
      if (hoveredNodeId === nodeId) {
        restoreHoverTarget(nodeId);
        hoveredNodeId = null;
        scene.hoverTooltip.style.opacity = '0';
        onNodeHover(null, e);
      }
    });
  }
}

function applyHoverAttrs(
  el: SVGElement | undefined,
  attrs: Record<string, string>
): HoverRestoreEntry | null {
  const previousAttrs = new Map<string, string | null>();
  if (!el) {
    return null;
  }
  for (const [name, value] of Object.entries(attrs)) {
    previousAttrs.set(name, el.getAttribute(name));
    el.setAttribute(name, value);
  }
  return { element: el, previousAttrs };
}

function pushHoverEntry(entries: Map<SVGElement, HoverRestoreEntry>, entry: HoverRestoreEntry | null): void {
  if (entry && !entries.has(entry.element)) {
    entries.set(entry.element, entry);
  }
}

function restoreHoverEntries(entries: Map<SVGElement, HoverRestoreEntry>): void {
  for (const entry of entries.values()) {
    for (const [name, previous] of entry.previousAttrs.entries()) {
      if (previous === null) {
        entry.element.removeAttribute(name);
      } else {
        entry.element.setAttribute(name, previous);
      }
    }
  }
}
