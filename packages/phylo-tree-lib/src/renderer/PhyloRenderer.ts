import type { PhyloTree } from '../tree/types';
import type { TreeRenderOptions } from './render-options';
import { defaultTreeRenderOptions } from './render-options';
import type { EventHandler, RendererEvent, RendererEventMap, ViewTransform } from './core/types';
import { ViewState } from '../tree/ViewState';
import {
  applySceneViewState,
  applySceneVisualUpdates,
  mountScene,
} from './scene/tree-scene';
import {
  getTreeLabelLayer,
  getTreeLeafCount,
  shouldUseInteractionMode,
} from './runtime/interaction-runtime';
import {
  buildTreeRendererState,
  buildTreeRendererViewStateTransition,
  buildTreeRendererVisualTransition,
  type BuiltTreeRendererStateResult,
  type TreeRendererState,
} from './runtime/tree-render-session';
import { VisualUpdateScheduler } from './runtime/visual-update-scheduler';
import { InteractionController } from './interaction/interaction-controller';
import { RendererEventBus } from './renderer-event-bus';
import {
  RENDERER_INTERACTION_DENSE_LEAF_THRESHOLD,
  RENDERER_INTERACTION_IDLE_MS,
  RENDERER_MAX_ZOOM,
  RENDERER_MIN_ZOOM,
} from './renderer-constants';

export class PhyloRenderer {
  private readonly svg: SVGSVGElement;
  private readonly rootLayer: SVGGElement;
  private state: TreeRendererState | null = null;
  private transform: ViewTransform = { x: 0, y: 0, k: 1 };
  private readonly interactions: InteractionController;
  private readonly events = new RendererEventBus();
  private readonly visualUpdates: VisualUpdateScheduler<TreeRenderOptions>;

  constructor(svgElement: SVGSVGElement) {
    this.svg = svgElement;
    this.rootLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.rootLayer.setAttribute('class', 'phylo-root-layer');
    this.svg.appendChild(this.rootLayer);
    this.visualUpdates = new VisualUpdateScheduler((options) => this.applyVisualUpdates(options));
    this.interactions = new InteractionController(
      this.svg,
      {
        shouldUseInteractionMode: () =>
          shouldUseInteractionMode(
            this.getCurrentLeafCount(),
            this.state?.effectiveOptions ?? defaultTreeRenderOptions(),
            RENDERER_INTERACTION_DENSE_LEAF_THRESHOLD
          ),
        onInteractionModeChange: (active) => this.setInteractionMode(active),
        onTransformChange: (transform) => {
          this.transform = transform;
          this.applyTransform();
        },
        onBackgroundClick: (event) => this.emit('backgroundClick', null, event),
      },
      {
        minZoom: RENDERER_MIN_ZOOM,
        maxZoom: RENDERER_MAX_ZOOM,
        interactionIdleMs: RENDERER_INTERACTION_IDLE_MS,
      }
    );
  }

  render(
    tree: PhyloTree,
    viewStateOrOptions?: ViewState | Partial<TreeRenderOptions>,
    maybeOptions?: Partial<TreeRenderOptions>
  ): void {
    const { viewState, options } = this.resolveRenderArguments(viewStateOrOptions, maybeOptions);
    const cfg = { ...defaultTreeRenderOptions(), ...(options ?? {}) };
    this.rebuildTreeScene({
      tree,
      viewState,
      requestedOptions: cfg,
    });
  }

  updateVisuals(options: Partial<TreeRenderOptions>): void {
    const state = this.state;
    if (!state) {
      return;
    }
    const transition = buildTreeRendererVisualTransition(state, options);

    if (transition.kind === 'rebuild') {
      this.rebuildTreeScene(transition.nextState);
      return;
    }

    this.state = transition.state;
    this.visualUpdates.schedule(transition.visualOptions);
  }

  updateViewState(viewState: ViewState): void {
    const state = this.state;
    if (!state) {
      return;
    }
    const transition = buildTreeRendererViewStateTransition(state, viewState);

    if (transition.kind === 'rebuild') {
      this.rebuildTreeScene(transition.nextState);
      return;
    }

    this.state = transition.state;
    this.applyViewState(transition.state.viewState);
  }

  getMode(): 'tree' | null {
    return this.state ? 'tree' : null;
  }

  getViewState(): ViewState {
    return this.state?.viewState ?? ViewState.empty();
  }

  getTreeRenderOptions(): TreeRenderOptions {
    return this.state?.requestedOptions ?? defaultTreeRenderOptions();
  }

  resetView(): void {
    this.interactions.resetView();
  }

  zoomTo(scale: number): void {
    this.interactions.zoomTo(scale);
  }

  on<K extends RendererEvent>(event: K, handler: EventHandler<RendererEventMap[K]>): void {
    this.events.on(event, handler);
  }

  off<K extends RendererEvent>(event: K, handler: EventHandler<RendererEventMap[K]>): void {
    this.events.off(event, handler);
  }

  destroy(): void {
    this.interactions.destroy();
    this.visualUpdates.clear();
    this.events.clear();
    this.rootLayer.innerHTML = '';
    this.state = null;
  }

  private emit<K extends RendererEvent>(
    event: K,
    payload: RendererEventMap[K],
    e: MouseEvent
  ): void {
    this.events.emit(event, payload, e);
  }

  private applyTransform(): void {
    this.rootLayer.setAttribute(
      'transform',
      `translate(${this.transform.x},${this.transform.y}) scale(${this.transform.k})`
    );
  }

  private rebuildTreeScene(
    nextState: Pick<TreeRendererState, 'tree' | 'viewState' | 'requestedOptions'>
  ): void {
    const result = buildTreeRendererState({
      tree: nextState.tree,
      viewState: nextState.viewState,
      requestedOptions: nextState.requestedOptions,
      callbacks: {
        onNodeClick: (payload, event) => this.emit('nodeClick', payload, event),
        onNodeHover: (payload, event) => this.emit('nodeHover', payload, event),
      },
    });
    this.applyBuiltRendererState(result);
  }

  private applyVisualUpdates(options: TreeRenderOptions): void {
    const scene = this.state?.scene;
    const viewState = this.state?.viewState;
    if (!scene || !viewState) return;
    applySceneVisualUpdates(scene, options);
    this.applyViewState(viewState);
  }

  private applyViewState(viewState: ViewState): void {
    const scene = this.state?.scene;
    const options = this.state?.effectiveOptions;
    if (!scene || !options) return;
    applySceneViewState(scene, viewState, options);
  }

  private getCurrentLeafCount(): number {
    return getTreeLeafCount(this.state?.tree ?? null);
  }

  private getLabelLayer(): SVGGElement | null {
    return getTreeLabelLayer(this.state?.scene ?? null);
  }

  private restoreStateAfterInteraction(): void {
    if (this.state?.scene) {
      this.applyViewState(this.state.viewState);
    }
  }

  private setInteractionMode(active: boolean): void {
    const labelLayer = this.getLabelLayer();
    const scene = this.state?.scene;

    if (labelLayer) {
      labelLayer.style.display = active ? 'none' : '';
    }

    if (scene) {
      scene.nodes.style.pointerEvents = active ? 'none' : '';
      scene.nodes.style.display = active ? 'none' : '';
      scene.markers.style.display = active ? 'none' : '';
      scene.overlays.style.display = active ? 'none' : '';
    }

    this.rootLayer.style.shapeRendering = active ? 'optimizeSpeed' : '';

    if (!active) {
      this.restoreStateAfterInteraction();
    }
  }

  private applyBuiltRendererState(result: BuiltTreeRendererStateResult): void {
    this.svg.setAttribute('viewBox', `0 0 ${result.viewport.width} ${result.viewport.height}`);
    this.svg.setAttribute('width', String(result.viewport.width));
    this.svg.setAttribute('height', String(result.viewport.height));
    this.rootLayer.innerHTML = '';
    mountScene(this.rootLayer, result.state.scene);
    this.state = result.state;
    this.interactions.requestTransformApply();
    this.applyViewState(result.state.viewState);
  }

  private resolveRenderArguments(
    viewStateOrOptions?: ViewState | Partial<TreeRenderOptions>,
    maybeOptions?: Partial<TreeRenderOptions>
  ): { viewState: ViewState; options?: Partial<TreeRenderOptions> } {
    if (viewStateOrOptions instanceof ViewState) {
      return {
        viewState: viewStateOrOptions,
        options: maybeOptions,
      };
    }

    return {
      viewState: ViewState.empty(),
      options: viewStateOrOptions,
    };
  }
}
