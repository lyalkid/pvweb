import { clamp } from '../core/math';
import {
  computeWheelTransform,
  getSvgClientPoint,
} from '../runtime/interaction-runtime';
import type { ViewTransform } from '../core/types';

interface InteractionControllerConfig {
  minZoom: number;
  maxZoom: number;
  interactionIdleMs: number;
}

interface InteractionControllerCallbacks {
  shouldUseInteractionMode: () => boolean;
  onInteractionModeChange: (active: boolean) => void;
  onTransformChange: (transform: ViewTransform) => void;
  onBackgroundClick: (event: MouseEvent) => void;
}

export class InteractionController {
  private readonly svg: SVGSVGElement;
  private readonly callbacks: InteractionControllerCallbacks;
  private readonly config: InteractionControllerConfig;

  private transform: ViewTransform = { x: 0, y: 0, k: 1 };
  private transformRaf: number | null = null;
  private interactionIdleTimer: number | null = null;
  private interactionMode = false;
  private dragging = false;
  private dragStart: { x: number; y: number } | null = null;
  private previousBodyUserSelect = '';
  private previousBodyWebkitUserSelect = '';
  private previousSvgCursor = '';

  private readonly onWheelBound: (e: WheelEvent) => void;
  private readonly onMouseDownBound: (e: MouseEvent) => void;
  private readonly onMouseMoveBound: (e: MouseEvent) => void;
  private readonly onMouseUpBound: () => void;
  private readonly onClickBound: (e: MouseEvent) => void;

  constructor(
    svg: SVGSVGElement,
    callbacks: InteractionControllerCallbacks,
    config: InteractionControllerConfig
  ) {
    this.svg = svg;
    this.callbacks = callbacks;
    this.config = config;

    this.onWheelBound = (e) => this.onWheel(e);
    this.onMouseDownBound = (e) => this.onMouseDown(e);
    this.onMouseMoveBound = (e) => this.onMouseMove(e);
    this.onMouseUpBound = () => this.onMouseUp();
    this.onClickBound = (e) => this.onClick(e);

    this.bind();
  }

  resetView(): void {
    this.transform = { x: 0, y: 0, k: 1 };
    this.scheduleTransform();
  }

  zoomTo(scale: number): void {
    this.transform.k = clamp(scale, this.config.minZoom, this.config.maxZoom);
    this.scheduleTransform();
  }

  requestTransformApply(): void {
    this.scheduleTransform();
  }

  destroy(): void {
    this.unbind();
    if (this.transformRaf !== null) {
      window.cancelAnimationFrame(this.transformRaf);
      this.transformRaf = null;
    }
    if (this.interactionIdleTimer !== null) {
      window.clearTimeout(this.interactionIdleTimer);
      this.interactionIdleTimer = null;
    }
    this.interactionMode = false;
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

  private onClick(e: MouseEvent): void {
    if (e.target === this.svg) {
      this.callbacks.onBackgroundClick(e);
    }
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) {
      return;
    }

    e.preventDefault();
    this.dragging = true;
    this.dragStart = getSvgClientPoint(this.svg, e.clientX, e.clientY);
    this.beginDragUiState();
    this.beginInteractionMode();
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.dragging || !this.dragStart) {
      return;
    }

    e.preventDefault();
    const pointer = getSvgClientPoint(this.svg, e.clientX, e.clientY);
    const dx = pointer.x - this.dragStart.x;
    const dy = pointer.y - this.dragStart.y;
    this.dragStart = pointer;

    this.transform.x += dx;
    this.transform.y += dy;
    this.scheduleTransform();
  }

  private onMouseUp(): void {
    this.dragging = false;
    this.dragStart = null;
    this.restoreDragUiState();
    this.scheduleInteractionModeExit();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.beginInteractionMode();

    const pointer = getSvgClientPoint(this.svg, e.clientX, e.clientY);

    this.transform = computeWheelTransform(
      this.transform,
      pointer.x,
      pointer.y,
      e.deltaY,
      this.config.minZoom,
      this.config.maxZoom
    );

    this.scheduleTransform();
    this.scheduleInteractionModeExit();
  }

  private scheduleTransform(): void {
    if (this.transformRaf !== null) {
      return;
    }

    this.transformRaf = window.requestAnimationFrame(() => {
      this.transformRaf = null;
      this.callbacks.onTransformChange(this.transform);
    });
  }

  private beginInteractionMode(): void {
    if (!this.callbacks.shouldUseInteractionMode()) {
      return;
    }

    if (!this.interactionMode) {
      this.setInteractionMode(true);
    }

    if (this.interactionIdleTimer !== null) {
      window.clearTimeout(this.interactionIdleTimer);
      this.interactionIdleTimer = null;
    }
  }

  private scheduleInteractionModeExit(): void {
    if (!this.interactionMode) {
      return;
    }

    if (this.interactionIdleTimer !== null) {
      window.clearTimeout(this.interactionIdleTimer);
    }

    this.interactionIdleTimer = window.setTimeout(() => {
      this.interactionIdleTimer = null;
      this.setInteractionMode(false);
    }, this.config.interactionIdleMs);
  }

  private setInteractionMode(active: boolean): void {
    if (this.interactionMode === active) {
      return;
    }
    this.interactionMode = active;
    this.callbacks.onInteractionModeChange(active);
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
