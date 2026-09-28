import type { ViewTransform } from '../renderer/core/types';
import { getSvgClientPoint } from '../renderer/runtime/interaction-runtime';

export interface TanglegramViewportOptions {
  minZoom: number;
  maxZoom: number;
}

export interface TanglegramViewportCallbacks {
  onTransformChange?: (transform: ViewTransform) => void;
  onBackgroundClick?: (event: MouseEvent) => void;
}

export function defaultTanglegramViewportOptions(): TanglegramViewportOptions {
  return {
    minZoom: 0.2,
    maxZoom: 64,
  };
}

export class TanglegramViewportController {
  private transform: ViewTransform = { x: 0, y: 0, k: 1 };
  private dragging = false;
  private dragStart: { x: number; y: number } | null = null;
  private readonly options: TanglegramViewportOptions;
  private readonly callbacks: TanglegramViewportCallbacks;
  private previousBodyUserSelect = '';
  private previousBodyWebkitUserSelect = '';
  private previousSvgCursor = '';

  private readonly onWheelBound: (event: WheelEvent) => void;
  private readonly onMouseDownBound: (event: MouseEvent) => void;
  private readonly onMouseMoveBound: (event: MouseEvent) => void;
  private readonly onMouseUpBound: () => void;
  private readonly onClickBound: (event: MouseEvent) => void;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly rootLayer: SVGGElement,
    options: Partial<TanglegramViewportOptions> = {},
    callbacks: TanglegramViewportCallbacks = {}
  ) {
    this.options = { ...defaultTanglegramViewportOptions(), ...options };
    this.callbacks = callbacks;

    this.onWheelBound = (event) => this.onWheel(event);
    this.onMouseDownBound = (event) => this.onMouseDown(event);
    this.onMouseMoveBound = (event) => this.onMouseMove(event);
    this.onMouseUpBound = () => this.onMouseUp();
    this.onClickBound = (event) => this.onClick(event);

    this.bind();
    this.applyTransform();
  }

  resetView(): void {
    this.transform = { x: 0, y: 0, k: 1 };
    this.applyTransform();
  }

  zoomTo(scale: number): void {
    this.transform = {
      ...this.transform,
      k: clamp(scale, this.options.minZoom, this.options.maxZoom),
    };
    this.applyTransform();
  }

  setTransform(transform: ViewTransform): void {
    this.transform = {
      x: transform.x,
      y: transform.y,
      k: clamp(transform.k, this.options.minZoom, this.options.maxZoom),
    };
    this.applyTransform();
  }

  getTransform(): ViewTransform {
    return { ...this.transform };
  }

  destroy(): void {
    this.unbind();
    this.dragging = false;
    this.dragStart = null;
    this.restoreDragUiState();
  }

  private bind(): void {
    this.svg.addEventListener('wheel', this.onWheelBound, { passive: false });
    this.svg.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    this.svg.addEventListener('click', this.onClickBound);
  }

  private unbind(): void {
    this.svg.removeEventListener('wheel', this.onWheelBound);
    this.svg.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    this.svg.removeEventListener('click', this.onClickBound);
  }

  private onClick(event: MouseEvent): void {
    if (event.target === this.svg) {
      this.callbacks.onBackgroundClick?.(event);
    }
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    this.dragging = true;
    this.dragStart = getSvgClientPoint(this.svg, event.clientX, event.clientY);
    this.beginDragUiState();
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.dragging || !this.dragStart) {
      return;
    }

    event.preventDefault();
    const pointer = getSvgClientPoint(this.svg, event.clientX, event.clientY);
    const dx = pointer.x - this.dragStart.x;
    const dy = pointer.y - this.dragStart.y;
    this.dragStart = pointer;
    this.transform = {
      ...this.transform,
      x: this.transform.x + dx,
      y: this.transform.y + dy,
    };
    this.applyTransform();
  }

  private onMouseUp(): void {
    this.dragging = false;
    this.dragStart = null;
    this.restoreDragUiState();
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const pointer = getSvgClientPoint(this.svg, event.clientX, event.clientY);
    this.transform = computeWheelTransform(
      this.transform,
      pointer.x,
      pointer.y,
      event.deltaY,
      this.options.minZoom,
      this.options.maxZoom
    );
    this.applyTransform();
  }

  private applyTransform(): void {
    this.rootLayer.setAttribute(
      'transform',
      `translate(${this.transform.x},${this.transform.y}) scale(${this.transform.k})`
    );
    this.callbacks.onTransformChange?.(this.getTransform());
  }

  private beginDragUiState(): void {
    this.previousBodyUserSelect = document.body.style.userSelect;
    this.previousBodyWebkitUserSelect = document.body.style.webkitUserSelect;
    this.previousSvgCursor = this.svg.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    this.svg.style.cursor = 'grabbing';
  }

  private restoreDragUiState(): void {
    document.body.style.userSelect = this.previousBodyUserSelect;
    document.body.style.webkitUserSelect = this.previousBodyWebkitUserSelect;
    this.svg.style.cursor = this.previousSvgCursor;
  }
}

function computeWheelTransform(
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
