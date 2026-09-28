import type { PositionedNode } from '../core/types';
import type { TreeRenderOptions } from '../render-options';
import {
  angleFromCenter,
  buildCircularLinkPath,
  buildCollapseMarker,
  distance,
  isCircularMode,
  isPhylogramMode,
  isRectangularMode,
} from './tree-scene-geometry';
import type { SceneBuildOptions } from './tree-scene';

export interface TreeSceneLineModel {
  childId: string;
  kind: 'path' | 'line';
  d?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface TreeSceneNodeModel {
  nodeId: string;
  x: number;
  y: number;
  radius: number;
}

export interface TreeSceneMarkerModel {
  nodeId: string;
  points: string;
}

export interface TreeSceneLeaderModel {
  nodeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TreeSceneLabelModel {
  nodeId: string;
  text: string;
  x: number;
  y: number;
  dy?: string;
  textAnchor?: string;
  transform?: string;
}

export interface TreeSceneModel {
  parentById: Map<string, string | null>;
  lines: TreeSceneLineModel[];
  nodes: TreeSceneNodeModel[];
  markers: TreeSceneMarkerModel[];
  leaders: TreeSceneLeaderModel[];
  labels: TreeSceneLabelModel[];
}

export function buildTreeSceneModel(
  items: PositionedNode[],
  cfg: TreeRenderOptions,
  options: SceneBuildOptions,
): TreeSceneModel {
  const byId = new Map(items.map((item) => [item.node.id, item]));
  const parentById = new Map<string, string | null>();
  const lines: TreeSceneLineModel[] = [];
  const nodes: TreeSceneNodeModel[] = [];
  const markers: TreeSceneMarkerModel[] = [];
  const leaders: TreeSceneLeaderModel[] = [];
  const labels: TreeSceneLabelModel[] = [];
  const isRectangular = isRectangularMode(cfg.mode);
  const isCircular = isCircularMode(cfg.mode);
  const centerX = cfg.width / 2;
  const centerY = cfg.height / 2;
  const leafItems = items.filter((item) => item.node.children.length === 0);
  const maxLeafRadius = Math.max(0, ...leafItems.map((item) => distance(item.x, item.y, centerX, centerY)));
  const maxLeafX = leafItems.length > 0 ? Math.max(...leafItems.map((item) => item.x)) : 0;
  const minLeafX = leafItems.length > 0 ? Math.min(...leafItems.map((item) => item.x)) : 0;
  const alignedLabelPad = 84;
  const alignedLabelX = cfg.mirror ? minLeafX - alignedLabelPad : maxLeafX + alignedLabelPad;

  for (const item of items) {
    parentById.set(item.node.id, item.parentId);
    if (!item.parentId) continue;
    const parent = byId.get(item.parentId);
    if (!parent) continue;

    if (isRectangular) {
      lines.push({
        childId: item.node.id,
        kind: 'path',
        d: `M${parent.x},${parent.y} V${item.y} H${item.x}`,
      });
    } else if (isCircular) {
      lines.push({
        childId: item.node.id,
        kind: 'path',
        d: buildCircularLinkPath(parent, item, centerX, centerY),
      });
    } else {
      lines.push({
        childId: item.node.id,
        kind: 'line',
        x1: parent.x,
        y1: parent.y,
        x2: item.x,
        y2: item.y,
      });
    }
  }

  for (const item of items) {
    nodes.push({
      nodeId: item.node.id,
      x: item.x,
      y: item.y,
      radius: cfg.nodeSize,
    });

    if (item.collapsed) {
      markers.push({
        nodeId: item.node.id,
        points: buildCollapseMarker(item, cfg, centerX, centerY),
      });
    }

    if (!options.renderLabels || !item.node.name) {
      continue;
    }

    const isLeaf = item.node.children.length === 0;
    const labelDirection = cfg.mirror ? -1 : 1;
    const useAlignedRectLabels = isRectangular && isLeaf && cfg.alignTips;
    const labelOffset = useAlignedRectLabels ? alignedLabelPad : 8;
    const renderCircularInternalLabel = isCircular && !isLeaf && !cfg.alignTips;

    if (isCircular && !isLeaf && !renderCircularInternalLabel) {
      continue;
    }

    if (useAlignedRectLabels) {
      leaders.push({
        nodeId: item.node.id,
        x1: item.x,
        y1: item.y,
        x2: alignedLabelX - labelDirection * 6,
        y2: item.y,
      });
    }

    if (isCircular) {
      const nodeRadius = distance(item.x, item.y, centerX, centerY);
      const alignOffset = Math.max(18, cfg.labelSize * 1.4);
      const labelPadding = Math.max(6, cfg.labelSize * 0.55);
      const labelRadius =
        isLeaf && cfg.alignTips
          ? isPhylogramMode(cfg.mode)
            ? maxLeafRadius + alignOffset + labelPadding
            : nodeRadius + alignOffset + labelPadding
          : nodeRadius + Math.max(4, labelPadding * 0.75);
      const angle = angleFromCenter(item.x, item.y, centerX, centerY);
      const labelX = centerX + Math.cos(angle) * labelRadius;
      const labelY = centerY + Math.sin(angle) * labelRadius;
      let degrees = (angle * 180) / Math.PI;
      if (degrees < 0) degrees += 360;
      const flipped = degrees > 90 && degrees < 270;
      if (flipped) {
        degrees += 180;
      }

      if (isLeaf && cfg.alignTips) {
        const leaderRadius = isPhylogramMode(cfg.mode)
          ? maxLeafRadius + alignOffset
          : nodeRadius + alignOffset;
        leaders.push({
          nodeId: item.node.id,
          x1: item.x,
          y1: item.y,
          x2: centerX + Math.cos(angle) * leaderRadius,
          y2: centerY + Math.sin(angle) * leaderRadius,
        });
      }

      labels.push({
        nodeId: item.node.id,
        text: item.node.name,
        x: labelX,
        y: labelY,
        dy: '0.32em',
        textAnchor: flipped ? 'end' : 'start',
        transform: `rotate(${degrees},${labelX},${labelY})`,
      });
      continue;
    }

    labels.push({
      nodeId: item.node.id,
      text: item.node.name,
      x: useAlignedRectLabels ? alignedLabelX : item.x + labelDirection * labelOffset,
      y: item.y + 4,
      textAnchor: cfg.mirror ? 'end' : 'start',
    });
  }

  return {
    parentById,
    lines,
    nodes,
    markers,
    leaders,
    labels,
  };
}
