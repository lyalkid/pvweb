import type { TreeRenderOptions } from '../render-options';

export function isCircularMode(mode: TreeRenderOptions['mode']): boolean {
  return mode === 'circular-cladogram' || mode === 'circular-phylogram';
}

export function isPhylogramMode(mode: TreeRenderOptions['mode']): boolean {
  return mode === 'circular-phylogram' || mode === 'rectangular-phylogram';
}

export function isRectangularMode(mode: TreeRenderOptions['mode']): boolean {
  return mode === 'rectangular-cladogram' || mode === 'rectangular-phylogram';
}
