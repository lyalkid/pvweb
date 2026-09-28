export interface BaseRenderOptions {
  width: number;
  height: number;
  branchColor: string;
  branchWidth: number;
  nodeColor: string;
  nodeSize: number;
  showLabels: boolean;
  labelSize: number;
}

/**
 * Настройки рендера одиночного дерева.
 *
 * Это основной публичный контракт между UI и текущим tree-render API.
 * Структурные параметры (`mode`, `width`, `height`, `mirror`, `alignTips`, `layoutSpacingX`, `layoutSpacingY`, `startAngle`, `arcAngle`)
 * требуют перерасчета layout, остальные могут обновляться частично.
 */
export interface TreeRenderOptions extends BaseRenderOptions {
  mode:
    | 'circular-cladogram'
    | 'circular-phylogram'
    | 'rectangular-cladogram'
    | 'rectangular-phylogram';
  mirror: boolean;
  alignTips: boolean;
  layoutSpacingX: number;
  layoutSpacingY: number;
  startAngle: number;
  arcAngle: number;
}

export function defaultTreeRenderOptions(): TreeRenderOptions {
  return {
    mode: 'rectangular-cladogram',
    width: 900,
    height: 600,
    mirror: false,
    alignTips: true,
    layoutSpacingX: 1,
    layoutSpacingY: 1,
    startAngle: 0,
    arcAngle: 360,
    branchColor: '#2a6f97',
    branchWidth: 1.2,
    nodeColor: '#1d3557',
    nodeSize: 3,
    showLabels: true,
    labelSize: 12,
  };
}
