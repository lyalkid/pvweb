import type { PhyloTree } from '../../tree/types';
import { buildTreeRenderModel } from '../../tree/pipeline';
import { ViewState } from '../../tree/ViewState';
import type { NodeClickPayload, NodeHoverPayload } from '../core/types';
import type { TreeRenderOptions } from '../render-options';
import { buildScene, type BuiltScene } from '../scene/tree-scene';
import { buildTreeVisualUpdatePlan } from './tree-runtime';
import { isCircularMode } from './mode-utils';

export interface TreeRendererState {
  tree: PhyloTree;
  viewState: ViewState;
  requestedOptions: TreeRenderOptions;
  effectiveOptions: TreeRenderOptions;
  scene: BuiltScene;
}

export interface TreeRendererViewport {
  width: number;
  height: number;
}

interface TreeSceneEventCallbacks {
  onNodeClick: (payload: NodeClickPayload, event: MouseEvent) => void;
  onNodeHover: (payload: NodeHoverPayload, event: MouseEvent) => void;
}

interface BuildTreeRendererStateInput {
  tree: PhyloTree;
  viewState: ViewState;
  requestedOptions: TreeRenderOptions;
  callbacks: TreeSceneEventCallbacks;
}

export interface BuiltTreeRendererStateResult {
  state: TreeRendererState;
  viewport: TreeRendererViewport;
}

type TreeRendererVisualTransition =
  | {
      kind: 'rebuild';
      nextState: Pick<TreeRendererState, 'tree' | 'viewState' | 'requestedOptions'>;
    }
  | {
      kind: 'visual-update';
      state: TreeRendererState;
      visualOptions: TreeRenderOptions;
    };

type TreeRendererViewStateTransition =
  | {
      kind: 'rebuild';
      nextState: Pick<TreeRendererState, 'tree' | 'viewState' | 'requestedOptions'>;
    }
  | {
      kind: 'view-state';
      state: TreeRendererState;
    };

export function buildTreeRendererState(
  input: BuildTreeRendererStateInput
): BuiltTreeRendererStateResult {
  const model = buildTreeRenderModel({
    tree: input.tree,
    options: input.requestedOptions,
    viewState: input.viewState,
  });
  const viewport = buildTreeRendererViewport(model.layout, model.effectiveOptions);
  const sceneOptions: TreeRenderOptions = {
    ...model.effectiveOptions,
    width: viewport.width,
    height: viewport.height,
  };

  const scene = buildScene(
    model.layout,
    sceneOptions,
    (nodeId, event) => input.callbacks.onNodeClick({ nodeId }, event),
    (nodeId, event) => input.callbacks.onNodeHover({ nodeId }, event),
    model.scene
  );

  return {
    state: {
      tree: model.tree,
      viewState: model.viewState,
      requestedOptions: model.requestedOptions,
      effectiveOptions: sceneOptions,
      scene,
    },
    viewport,
  };
}

export function buildTreeRendererVisualTransition(
  state: TreeRendererState,
  optionsPatch: Partial<TreeRenderOptions>
): TreeRendererVisualTransition {
  const nextOptions = { ...state.requestedOptions, ...optionsPatch };
  const updatePlan = buildTreeVisualUpdatePlan(
    state.tree,
    state.requestedOptions,
    nextOptions
  );

  if (updatePlan.requiresRebuild) {
    return {
      kind: 'rebuild',
      nextState: {
        tree: state.tree,
        viewState: state.viewState,
        requestedOptions: updatePlan.requestedOptions,
      },
    };
  }

  return {
    kind: 'visual-update',
    state: {
      ...state,
      requestedOptions: updatePlan.requestedOptions,
      effectiveOptions: updatePlan.effectiveOptions,
    },
    visualOptions: updatePlan.effectiveOptions,
  };
}

export function buildTreeRendererViewStateTransition(
  state: TreeRendererState,
  viewState: ViewState
): TreeRendererViewStateTransition {
  const hadCollapseChanges =
    state.viewState.toJSON().collapsed.join('\u0000') !==
    viewState.toJSON().collapsed.join('\u0000');

  if (hadCollapseChanges) {
    return {
      kind: 'rebuild',
      nextState: {
        tree: state.tree,
        viewState,
        requestedOptions: state.requestedOptions,
      },
    };
  }

  return {
    kind: 'view-state',
    state: {
      ...state,
      viewState,
    },
  };
}

export function buildTreeRendererViewport(
  layout: ReturnType<typeof buildTreeRenderModel>['layout'],
  options: TreeRenderOptions
): TreeRendererViewport {
  if (layout.length === 0) {
    return {
      width: options.width,
      height: options.height,
    };
  }

  const maxX = Math.max(...layout.map((node) => node.x));
  const maxY = Math.max(...layout.map((node) => node.y));
  const labelWidthPadding = !options.showLabels
    ? 48
    : isCircularMode(options.mode)
      ? 48
      : Math.max(96, options.labelSize * 10);
  const labelHeightPadding = options.showLabels ? Math.max(24, options.labelSize * 2) : 24;

  return {
    width: Math.max(options.width, Math.ceil(maxX + labelWidthPadding)),
    height: Math.max(options.height, Math.ceil(maxY + labelHeightPadding)),
  };
}
