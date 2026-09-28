export type {
  TanglePair,
  TanglegramPairSummary,
  TanglegramSide,
  TanglegramTrees,
} from './types';

export {
  buildTanglePairKey,
  buildTanglegramPairs,
  summarizeTanglegramPairs,
} from './matching';

export type { TanglegramStateSnapshot } from './TanglegramState';
export { TanglegramState } from './TanglegramState';

export type { TanglegramSnapshot } from './TanglegramSnapshot';
export {
  createTanglegramSnapshot,
  updateTanglegramSnapshot,
} from './TanglegramSnapshot';

export type {
  TanglegramConnectionDensityMode,
  TanglegramConnectionVisibilityMode,
  TanglegramLabelDensityMode,
  TanglegramRenderOptions,
} from './render-options';
export { defaultTanglegramRenderOptions } from './render-options';

export type {
  TanglegramConnectionLayout,
  TanglegramLayout,
  TanglegramSideLayout,
} from './layout';
export { computeTanglegramLayout } from './layout';

export type {
  BuildTanglegramModelInput,
  BuiltTanglegramModel,
} from './pipeline';
export { buildTanglegramModel } from './pipeline';

export type {
  TanglegramSceneInput,
  TanglegramRenderedScene,
} from './scene';
export { renderTanglegramSvg } from './scene';

export type {
  TanglegramViewportCallbacks,
  TanglegramViewportOptions,
} from './viewport';
export {
  defaultTanglegramViewportOptions,
  TanglegramViewportController,
} from './viewport';
