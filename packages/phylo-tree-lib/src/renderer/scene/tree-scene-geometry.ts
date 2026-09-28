import type { TreeRenderOptions } from '../render-options';
import type { PositionedNode } from '../core/types';

export function isRectangularMode(mode: TreeRenderOptions['mode']): boolean {
  return mode === 'rectangular-cladogram' || mode === 'rectangular-phylogram';
}

export function isCircularMode(mode: TreeRenderOptions['mode']): boolean {
  return mode === 'circular-cladogram' || mode === 'circular-phylogram';
}

export function isPhylogramMode(mode: TreeRenderOptions['mode']): boolean {
  return mode === 'circular-phylogram' || mode === 'rectangular-phylogram';
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleFromCenter(x: number, y: number, centerX: number, centerY: number): number {
  let angle = Math.atan2(y - centerY, x - centerX);
  if (angle < 0) {
    angle += Math.PI * 2;
  }
  return angle;
}

export function buildCircularLinkPath(
  parent: PositionedNode,
  child: PositionedNode,
  centerX: number,
  centerY: number
): string {
  const sourceAngle = parent.angle ?? angleFromCenter(parent.x, parent.y, centerX, centerY);
  const targetAngle = child.angle ?? angleFromCenter(child.x, child.y, centerX, centerY);
  const sourceRadius = distance(parent.x, parent.y, centerX, centerY);
  const arcEndX = centerX + Math.cos(targetAngle) * sourceRadius;
  const arcEndY = centerY + Math.sin(targetAngle) * sourceRadius;
  const delta = normalizeAngleDelta(targetAngle - sourceAngle);
  const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
  const sweep = delta >= 0 ? 1 : 0;

  return `M${parent.x},${parent.y} A${sourceRadius},${sourceRadius} 0 ${largeArc} ${sweep} ${arcEndX},${arcEndY} L${child.x},${child.y}`;
}

export function buildCollapseMarker(
  item: PositionedNode,
  cfg: TreeRenderOptions,
  centerX: number,
  centerY: number
): string {
  if (isCircularMode(cfg.mode)) {
    const angle = item.angle ?? angleFromCenter(item.x, item.y, centerX, centerY);
    const outwardX = -Math.cos(angle);
    const outwardY = -Math.sin(angle);
    const tangentX = -outwardY;
    const tangentY = outwardX;
    const length = 14;
    const halfBase = 7;
    const tipX = item.x + outwardX * length;
    const tipY = item.y + outwardY * length;
    const baseCenterX = item.x + outwardX * (length * 0.15);
    const baseCenterY = item.y + outwardY * (length * 0.15);
    const leftX = baseCenterX + tangentX * halfBase;
    const leftY = baseCenterY + tangentY * halfBase;
    const rightX = baseCenterX - tangentX * halfBase;
    const rightY = baseCenterY - tangentY * halfBase;
    return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
  }

  const direction = cfg.mirror ? 1 : -1;
  const width = 14;
  const height = 18;
  const tipX = item.x + direction * width;
  const tipY = item.y;
  const baseX = item.x;
  return `${tipX},${tipY} ${baseX},${item.y - height / 2} ${baseX},${item.y + height / 2}`;
}

function normalizeAngleDelta(delta: number): number {
  let next = delta;
  while (next <= -Math.PI * 2) {
    next += Math.PI * 2;
  }
  while (next > Math.PI * 2) {
    next -= Math.PI * 2;
  }
  if (next > Math.PI) {
    next -= Math.PI * 2;
  } else if (next < -Math.PI) {
    next += Math.PI * 2;
  }
  return next;
}

export function setTransition(el: SVGElement, enabled: boolean, value: string): void {
  el.style.transition = enabled ? value : '';
}
