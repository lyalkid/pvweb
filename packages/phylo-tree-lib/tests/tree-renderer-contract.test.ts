import { describe, expect, it } from 'vitest';
import { parseNewick } from '../src/parsers/newick';
import {
  buildTreeRenderModel,
  defaultTreeRenderOptions,
  ViewState,
} from '../src/index';
import {
  buildTreeLayoutPlan,
  buildTreeRuntimePlan,
  buildTreeRuntimePolicy,
  buildTreeSceneBuildOptions,
  normalizeTreeRenderOptions,
  resolveTreeLayoutKind,
} from '../src/renderer/runtime/tree-runtime';
import {
  buildTreeRendererViewport,
  buildTreeRendererViewStateTransition,
  buildTreeRendererVisualTransition,
} from '../src/renderer/runtime/tree-render-session';
import { buildParentById } from '../src/tree/tree-state-helpers';
import { buildBuiltSceneStateModel } from '../src/renderer/scene/tree-scene-state-model';

describe('single-tree render model pipeline baseline', () => {
  it('builds a composed render model from tree, options, and view state', () => {
    const tree = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const options = {
      ...defaultTreeRenderOptions(),
      mode: 'rectangular-cladogram' as const,
    };
    const viewState = ViewState.empty();
    const model = buildTreeRenderModel({
      tree,
      options,
      viewState,
    });

    expect(model.tree).toBe(tree);
    expect(model.viewState).toBe(viewState);
    expect(model.layout.length).toBeGreaterThan(0);
    expect(model.requestedOptions.mode).toBe('rectangular-cladogram');
    expect(model.effectiveOptions.mode).toBe('rectangular-cladogram');
    expect(typeof model.scene.renderLabels).toBe('boolean');
    expect(model.runtime.requestedOptions).toBe(model.requestedOptions);
    expect(model.runtime.effectiveOptions).toBe(model.effectiveOptions);
  });

  it('exposes separated runtime phases for policy, normalization, scene build, and layout planning', () => {
    const tree = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const options = {
      ...defaultTreeRenderOptions(),
      mode: 'circular-phylogram' as const,
    };
    const policy = buildTreeRuntimePolicy(tree, options);
    const effectiveOptions = normalizeTreeRenderOptions({
      requestedOptions: options,
      policy,
      tree,
    });
    const scene = buildTreeSceneBuildOptions(policy);
    const layoutPlan = buildTreeLayoutPlan({
      tree,
      options: effectiveOptions,
      viewState: ViewState.empty(),
    });
    const runtime = buildTreeRuntimePlan(tree, options);

    expect(resolveTreeLayoutKind(options)).toBe('circular');
    expect(policy.renderLabels).toBe(runtime.policy.renderLabels);
    expect(effectiveOptions.showLabels).toBe(runtime.effectiveOptions.showLabels);
    expect(scene.renderLabels).toBe(runtime.scene.renderLabels);
    expect(layoutPlan.kind).toBe('circular');
    expect(layoutPlan.config.useBranchLength).toBe(true);
  });

  it('exposes renderer-state transitions outside PhyloRenderer facade', () => {
    const tree = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const viewState = ViewState.empty();
    const options = {
      ...defaultTreeRenderOptions(),
      mode: 'rectangular-cladogram' as const,
    };
    const rendererState = {
      tree,
      viewState,
      requestedOptions: options,
      effectiveOptions: options,
      scene: {} as never,
    };

    const visualTransition = buildTreeRendererVisualTransition(rendererState, {
      branchWidth: 2,
    });
    const viewStateTransition = buildTreeRendererViewStateTransition(
      rendererState,
      viewState.setColor('AB', '#ff6600')
    );

    expect(visualTransition.kind).toBe('visual-update');
    expect(visualTransition.kind === 'visual-update' ? visualTransition.state.requestedOptions.branchWidth : 0).toBe(2);
    expect(viewStateTransition.kind).toBe('view-state');
    expect(viewStateTransition.kind === 'view-state' ? viewStateTransition.state.viewState.version : -1).toBeGreaterThan(viewState.version);
  });

  it('builds a model-first scene state plan for DOM application', () => {
    const tree = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const options = defaultTreeRenderOptions();
    const rootId = tree.root.id;
    const abId = tree.root.children[0]?.id;
    const aId = tree.root.children[0]?.children[0]?.id;
    const cId = tree.root.children[1]?.id;
    expect(rootId).toBeTruthy();
    expect(abId).toBeTruthy();
    expect(aId).toBeTruthy();
    expect(cId).toBeTruthy();

    const viewState = ViewState.empty().collapse(abId!).setColor(rootId, '#ff6600');
    const stateModel = buildBuiltSceneStateModel(viewState, buildParentById(tree), options);

    expect(stateModel.nodeElementsById.get(aId!)).toMatchObject({
      opacity: '0',
      pointerEvents: 'none',
      fill: '#ff6600',
    });
    expect(stateModel.lineElementsByChildId.get(cId!)).toMatchObject({
      opacity: '1',
      stroke: '#ff6600',
    });
    expect(stateModel.labelElementsById.get(aId!)).toMatchObject({
      opacity: '0',
      pointerEvents: 'none',
      fill: '#ff6600',
    });
  });

  it('uses layout spacing as a structural layout control and expands viewport accordingly', () => {
    const tree = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const baseOptions = defaultTreeRenderOptions();
    const baseModel = buildTreeRenderModel({
      tree,
      options: baseOptions,
      viewState: ViewState.empty(),
    });
    const spacedModel = buildTreeRenderModel({
      tree,
      viewState: ViewState.empty(),
      options: {
        ...baseOptions,
        layoutSpacingX: 1.8,
        layoutSpacingY: 1.6,
      },
    });
    const baseViewport = buildTreeRendererViewport(baseModel.layout, baseModel.effectiveOptions);
    const spacedViewport = buildTreeRendererViewport(spacedModel.layout, spacedModel.effectiveOptions);

    expect(spacedViewport.width).toBeGreaterThan(baseViewport.width);
    expect(spacedViewport.height).toBeGreaterThan(baseViewport.height);
  });
});
