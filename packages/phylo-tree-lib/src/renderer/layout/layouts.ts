import type { PhyloNode } from "../../tree/types";
import type { PositionedNode } from "../core/types";

export interface TreeLayoutConfig {
  width: number;
  height: number;
  mirror: boolean;
  useBranchLength: boolean;
  alignTips: boolean;
  layoutSpacingX: number;
  layoutSpacingY: number;
  startAngle: number;
  arcAngle: number;
  collapsedIds?: Set<string>;
}

interface VisibleLayoutNode {
  node: PhyloNode;
  parentId: string | null;
  children: VisibleLayoutNode[];
  collapsed: boolean;
  subtreeLeafCount: number;
  visibleWeight: number;
  x?: number;
  y?: number;
  angle?: number;
  rowHeight?: number;
}

export function layoutRectangular(
  root: PhyloNode,
  config: TreeLayoutConfig,
): PositionedNode[] {
  const collapsedIds = config.collapsedIds ?? new Set<string>();
  // Layout работает только с видимой проекцией дерева:
  // свернутый узел остается, но его потомки временно убираются из расчета.
  const tree = buildVisibleTree(root, null, collapsedIds);
  const totalWeight = Math.max(1, tree.visibleWeight);
  const spacingX = normalizeLayoutSpacingX(config.layoutSpacingX);
  const spacingY = normalizeLayoutSpacingY(config.layoutSpacingY);
  const padding = 40;
  const baseInnerWidth = Math.max(1, config.width - padding * 2);
  const baseInnerHeight = Math.max(1, config.height - padding * 2);
  const innerWidth = baseInnerWidth * spacingX;
  const innerHeight = baseInnerHeight * spacingY;
  // Каждый видимый лист получает одну вертикальную "строку",
  // а большие поддеревья занимают пропорционально больше места.
  const rowHeight = innerHeight / totalWeight;

  assignRectangularY(tree, padding, padding + innerHeight, rowHeight);

  const visibleNodes = flattenVisibleTree(tree);
  // Координата X считается либо по длинам ветвей (phylogram),
  // либо по топологической глубине (cladogram).
  const distById = config.useBranchLength
    ? computeBranchDistance(root)
    : computeCladogramDistance(root);
  const maxDistance = Math.max(
    1,
    ...visibleNodes.map((item) => distById.get(item.node.id) ?? 0),
  );
  const layoutWidth = padding * 2 + innerWidth;

  for (const item of visibleNodes) {
    const dist = distById.get(item.node.id) ?? 0;
    const x = padding + (dist / maxDistance) * innerWidth;
    item.x = config.mirror ? layoutWidth - x : x;
  }

  return visibleNodes.map(toPositionedNode);
}

export function layoutCircular(
  root: PhyloNode,
  config: TreeLayoutConfig,
): PositionedNode[] {
  const collapsedIds = config.collapsedIds ?? new Set<string>();
  const padding = 30;
  const tree = buildVisibleTree(root, null, collapsedIds);
  // В круговом режиме каждому видимому поддереву выделяется угловой сектор.
  const startAngle = degreesToRadians(config.startAngle);
  const arcAngle = degreesToRadians(normalizeArcDegrees(config.arcAngle));
  assignCircularAngles(tree, startAngle, startAngle + arcAngle);

  const visibleNodes = flattenVisibleTree(tree);
  // Радиус считается так же, как и в rectangular layout:
  // либо по длинам ветвей, либо по топологической глубине.
  const distById = config.useBranchLength
    ? computeBranchDistance(root)
    : computeCladogramDistance(root);
  const maxDepth = Math.max(
    1,
    ...visibleNodes.map((item) => distById.get(item.node.id) ?? 0),
  );
  const radiusMax = Math.min(config.width, config.height) / 2 - padding;

  for (const item of visibleNodes) {
    const dist = distById.get(item.node.id) ?? 0;
    const r = (dist / maxDepth) * radiusMax;
    let angle = item.angle ?? 0;
    if (config.mirror) {
      angle = Math.PI * 2 - angle;
    }
    // Для circular layout нельзя независимо растягивать X и Y:
    // иначе круг превращается в эллипс, а геометрия дуг и подписей ломается.
    item.x = Math.cos(angle) * r;
    item.y = Math.sin(angle) * r;
    item.angle = angle;
  }

  normalizeCircularNodes(visibleNodes, config.width, config.height);

  return visibleNodes.map(toPositionedNode);
}

function toPositionedNode(item: VisibleLayoutNode): PositionedNode {
  return {
    node: item.node,
    x: item.x ?? 0,
    y: item.y ?? 0,
    parentId: item.parentId,
    collapsed: item.collapsed,
    subtreeLeafCount: item.subtreeLeafCount,
    rowHeight: item.rowHeight,
    angle: item.angle,
  };
}

function buildVisibleTree(
  node: PhyloNode,
  parentId: string | null,
  collapsedIds: Set<string>,
): VisibleLayoutNode {
  const subtreeLeafCount = countLeaves(node);
  const collapsed = collapsedIds.has(node.id);
  const children =
    collapsed || node.children.length === 0
      ? []
      : node.children.map((child) =>
          buildVisibleTree(child, node.id, collapsedIds),
        );
  // visibleWeight показывает, сколько видимого layout-пространства
  // должно быть выделено поддереву.
  // Свернутый узел с точки зрения layout ведет себя как лист.
  const visibleWeight =
    collapsed || children.length === 0
      ? 1
      : children.reduce((sum, child) => sum + child.visibleWeight, 0);

  return {
    node,
    parentId,
    children,
    collapsed,
    subtreeLeafCount,
    visibleWeight,
  };
}

function assignRectangularY(
  node: VisibleLayoutNode,
  startY: number,
  endY: number,
  rowHeight: number,
): void {
  // Внутренний узел ставится в центр своего видимого диапазона,
  // а лист оказывается по центру выделенной ему строки.
  node.y = (startY + endY) / 2;
  node.rowHeight = rowHeight;

  if (node.children.length === 0) {
    return;
  }

  const totalWeight = Math.max(
    1,
    node.children.reduce((sum, child) => sum + child.visibleWeight, 0),
  );
  let cursor = startY;
  for (const child of node.children) {
    // Дети делят вертикальный диапазон пропорционально весу
    // их видимого поддерева.
    const span = ((endY - startY) * child.visibleWeight) / totalWeight;
    assignRectangularY(child, cursor, cursor + span, rowHeight);
    cursor += span;
  }
}

function assignCircularAngles(
  node: VisibleLayoutNode,
  startAngle: number,
  endAngle: number,
): void {
  // Для circular layout сектор не "заворачивается", поэтому середина
  // должна считаться как обычная середина интервала, а не как
  // усреднение векторов на окружности.
  node.angle = normalizeAngle(startAngle + (endAngle - startAngle) / 2);
  if (node.children.length === 0) {
    return;
  }

  const totalWeight = Math.max(
    1,
    node.children.reduce((sum, child) => sum + child.visibleWeight, 0),
  );
  let cursor = startAngle;
  const span = endAngle - startAngle;
  for (const child of node.children) {
    // Чем больше видимое поддерево, тем больший угловой сектор оно получает.
    const childSpan = (span * child.visibleWeight) / totalWeight;
    assignCircularAngles(child, cursor, cursor + childSpan);
    cursor += childSpan;
  }
}

function flattenVisibleTree(root: VisibleLayoutNode): VisibleLayoutNode[] {
  const out: VisibleLayoutNode[] = [];
  const stack: VisibleLayoutNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    out.push(node);
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push(node.children[i]);
    }
  }
  return out;
}

function computeCladogramDistance(root: PhyloNode): Map<string, number> {
  const heightById = new Map<string, number>();
  computeNodeHeight(root, heightById);
  const maxHeight = Math.max(1, heightById.get(root.id) ?? 1);
  const dist = new Map<string, number>();
  for (const [id, height] of heightById.entries()) {
    // В cladogram режиме листья должны оказаться дальше всего от корня,
    // поэтому расстояние выводится из высоты узла в топологии.
    dist.set(id, maxHeight - height);
  }
  return dist;
}

function computeNodeHeight(node: PhyloNode, out: Map<string, number>): number {
  if (node.children.length === 0) {
    out.set(node.id, 0);
    return 0;
  }
  let maxChild = 0;
  for (const child of node.children) {
    const childHeight = computeNodeHeight(child, out);
    if (childHeight > maxChild) {
      maxChild = childHeight;
    }
  }
  const height = maxChild + 1;
  out.set(node.id, height);
  return height;
}

function computeBranchDistance(root: PhyloNode): Map<string, number> {
  const dist = new Map<string, number>();
  const stack: Array<{ node: PhyloNode; total: number }> = [
    { node: root, total: 0 },
  ];
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;
    dist.set(item.node.id, item.total);
    for (let i = item.node.children.length - 1; i >= 0; i -= 1) {
      const child = item.node.children[i];
      // Если длина ветви не задана, берется 1,
      // чтобы phylogram режим все равно оставался рабочим.
      const length = child.branchLength ?? 1;
      stack.push({ node: child, total: item.total + length });
    }
  }
  return dist;
}

function countLeaves(node: PhyloNode): number {
  if (node.children.length === 0) {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function normalizeCircularNodes(
  nodes: VisibleLayoutNode[],
  width: number,
  height: number,
): void {
  if (nodes.length === 0) {
    return;
  }

  // Круговой layout строится вокруг математического центра (0, 0),
  // поэтому после расчета нужно просто перенести его в центр SVG.
  // Нельзя центрировать по bounding box: у несимметричного дерева
  // это смещает настоящий центр окружности и ломает дуги/подписи.
  const offsetX = width / 2;
  const offsetY = height / 2;

  for (const node of nodes) {
    node.x = (node.x ?? 0) + offsetX;
    node.y = (node.y ?? 0) + offsetY;
  }
}

function normalizeAngle(angle: number): number {
  let next = angle;
  while (next < 0) {
    next += Math.PI * 2;
  }
  while (next >= Math.PI * 2) {
    next -= Math.PI * 2;
  }
  return next;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function normalizeArcDegrees(value: number): number {
  if (!Number.isFinite(value)) {
    return 360;
  }
  return Math.min(360, Math.max(10, value));
}

function normalizeLayoutSpacingX(value: number): number {
  return Number.isFinite(value) ? Math.max(0.2, value) : 1;
}

function normalizeLayoutSpacingY(value: number): number {
  return Number.isFinite(value) ? Math.max(0.1, value) : 1;
}
