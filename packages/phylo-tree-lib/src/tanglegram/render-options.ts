export type TanglegramLabelDensityMode = 'all' | 'auto' | 'sparse';
export type TanglegramConnectionDensityMode = 'all' | 'auto' | 'sparse';
export type TanglegramConnectionVisibilityMode = 'all' | 'selection' | 'focus';

export interface TanglegramRenderOptions {
  width: number;
  height: number;
  gap: number;
  padding: number;
  branchColor: string;
  branchWidth: number;
  nodeColor: string;
  nodeSize: number;
  labelColor: string;
  labelSize: number;
  connectionColor: string;
  connectionWidth: number;
  connectionOpacity: number;
  connectionCurve: number;
  connectionVisibility: TanglegramConnectionVisibilityMode;
  connectionDensity: TanglegramConnectionDensityMode;
  connectionDensityStrideMultiplier: number;
  showLabelsA: boolean;
  showLabelsB: boolean;
  labelDensityA: TanglegramLabelDensityMode;
  labelDensityB: TanglegramLabelDensityMode;
  labelDensityGapMultiplier: number;
  alignTipsA: boolean;
  alignTipsB: boolean;
  useBranchLengthsA: boolean;
  useBranchLengthsB: boolean;
  layoutSpacingXA: number;
  layoutSpacingYA: number;
  layoutSpacingXB: number;
  layoutSpacingYB: number;
}

export function defaultTanglegramRenderOptions(): TanglegramRenderOptions {
  return {
    width: 1200,
    height: 700,
    gap: 140,
    padding: 48,
    branchColor: '#2a6f97',
    branchWidth: 1.2,
    nodeColor: '#16324f',
    nodeSize: 3,
    labelColor: '#16324f',
    labelSize: 12,
    connectionColor: '#7ac0b9',
    connectionWidth: 1.2,
    connectionOpacity: 0.7,
    connectionCurve: 0.35,
    connectionVisibility: 'all',
    connectionDensity: 'all',
    connectionDensityStrideMultiplier: 1,
    showLabelsA: true,
    showLabelsB: true,
    labelDensityA: 'all',
    labelDensityB: 'all',
    labelDensityGapMultiplier: 1,
    alignTipsA: true,
    alignTipsB: true,
    useBranchLengthsA: false,
    useBranchLengthsB: false,
    layoutSpacingXA: 1,
    layoutSpacingYA: 1,
    layoutSpacingXB: 1,
    layoutSpacingYB: 1,
  };
}
