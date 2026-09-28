import { describe, expect, it } from 'vitest';
import { parseNewick } from '../src/parsers/newick';
import {
  TanglegramState,
  applyTanglegramSideTreeAction,
  applyTanglegramSideViewAction,
  buildTanglegramModel,
  buildTanglePairKey,
  buildTanglegramPairs,
  computeTanglegramLayout,
  defaultTanglegramRenderOptions,
  PhyloTreeModel,
  renderTanglegramSvg,
  TanglegramViewportController,
  ViewState,
  summarizeTanglegramPairs,
} from '../src/index';

describe('new tanglegram contract baseline', () => {
  it('builds pairs from shared leaf names', () => {
    const treeA = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const treeB = parseNewick('((A:1,C:1)AC:1,D:1)ROOT;').tree;

    const summary = summarizeTanglegramPairs(treeA, treeB);

    expect(summary.pairs).toHaveLength(2);
    expect(summary.pairs.map((pair) => pair.sharedLabel)).toEqual(['A', 'C']);
    expect(summary.onlyInA).toEqual(['B']);
    expect(summary.onlyInB).toEqual(['D']);
  });

  it('keeps compare-specific state separate from tree mutations', () => {
    const key = buildTanglePairKey('left-1', 'right-1');
    const state = TanglegramState.empty()
      .selectNode('A', 'left-1')
      .hideConnection(key)
      .focusConnection(key);

    expect(state.selectedSide).toBe('A');
    expect(state.selectedNodeId).toBe('left-1');
    expect(state.focusedConnectionKey).toBe(key);
    expect(state.isConnectionHidden(key)).toBe(true);
    expect(TanglegramState.fromJSON(state.toJSON()).toJSON()).toEqual(state.toJSON());
  });

  it('supports explicit focus reset and focus toggling independently from hidden connections', () => {
    const key = buildTanglePairKey('left-1', 'right-1');
    const state = TanglegramState.empty()
      .focusConnection(key)
      .toggleFocusedConnection(key);

    expect(state.focusedConnectionKey).toBeNull();

    const next = state.toggleFocusedConnection(key);

    expect(next.focusedConnectionKey).toBe(key);
    expect(next.isConnectionHidden(key)).toBe(false);
  });

  it('supports duplicate leaf labels by pairing occurrences in stable order', () => {
    const treeA = parseNewick('((A:1,A:1)AA:1,B:1)ROOT;').tree;
    const treeB = parseNewick('((A:1,A:1)AA:1,C:1)ROOT;').tree;

    const pairs = buildTanglegramPairs(treeA, treeB);

    expect(pairs).toHaveLength(2);
    expect(new Set(pairs.map((pair) => pair.key)).size).toBe(2);
    expect(pairs.every((pair) => pair.sharedLabel === 'A')).toBe(true);
  });

  it('computes a minimal side-by-side layout for the new tanglegram renderer path', () => {
    const treeA = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const treeB = parseNewick('((A:1,C:1)AC:1,D:1)ROOT;').tree;
    const pairs = buildTanglegramPairs(treeA, treeB);

    const layout = computeTanglegramLayout(
      treeA,
      treeB,
      pairs,
      defaultTanglegramRenderOptions()
    );

    expect(layout.sideA.nodes.length).toBeGreaterThan(0);
    expect(layout.sideB.nodes.length).toBeGreaterThan(0);
    expect(layout.connections).toHaveLength(2);
    expect(layout.connections[0].startX).toBeLessThan(layout.connections[0].endX);
  });

  it('provides a recommended composed model builder for consumer-side integration', () => {
    const treeA = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const treeB = parseNewick('((A:1,C:1)AC:1,D:1)ROOT;').tree;
    const options = defaultTanglegramRenderOptions();
    const model = buildTanglegramModel({
      treeA,
      treeB,
      options,
      viewStateA: ViewState.empty(),
      viewStateB: ViewState.empty(),
    });

    expect(model.summary.pairs).toHaveLength(2);
    expect(model.layout.connections).toHaveLength(2);
    expect(model.layout.width).toBeGreaterThan(0);
    expect(model.layout.height).toBeGreaterThan(0);
  });

  it('exposes rebuilt tanglegram contracts through the public root barrel', () => {
    expect(typeof buildTanglegramModel).toBe('function');
    expect(typeof computeTanglegramLayout).toBe('function');
    expect(typeof renderTanglegramSvg).toBe('function');
    expect(typeof TanglegramViewportController).toBe('function');
  });

  it('respects per-side collapsed nodes when building tanglegram layout', () => {
    const treeA = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const treeB = parseNewick('((A:1,C:1)AC:1,D:1)ROOT;').tree;
    const pairs = buildTanglegramPairs(treeA, treeB);
    const collapseId = new PhyloTreeModel(treeA).findByName('AB')[0]?.id;

    expect(collapseId).toBeTruthy();

    const layout = computeTanglegramLayout(
      treeA,
      treeB,
      pairs,
      defaultTanglegramRenderOptions(),
      {
        viewStateA: ViewState.empty().collapse(collapseId as string),
      }
    );

    expect(layout.sideA.nodeById.has(collapseId as string)).toBe(true);
    expect(layout.sideA.nodes.some((node) => node.node.name === 'A')).toBe(false);
    expect(layout.sideA.nodes.some((node) => node.node.name === 'B')).toBe(false);
  });

  it('scales each side around its own visible vertical center instead of the scene center', () => {
    const treeA = parseNewick('(((A:1,B:1)AB:1,C:1)ABC:1,D:1)ROOT;').tree;
    const treeB = parseNewick('((A:1,C:1)AC:1,D:1)ROOT;').tree;
    const pairs = buildTanglegramPairs(treeA, treeB);
    const base = computeTanglegramLayout(treeA, treeB, pairs, defaultTanglegramRenderOptions());
    const scaled = computeTanglegramLayout(
      treeA,
      treeB,
      pairs,
      {
        ...defaultTanglegramRenderOptions(),
        layoutSpacingYA: 0.5,
      }
    );

    const baseYs = base.sideA.nodes.map((node) => node.y);
    const scaledYs = scaled.sideA.nodes.map((node) => node.y);
    const baseCenter = (Math.min(...baseYs) + Math.max(...baseYs)) / 2;
    const scaledCenter = (Math.min(...scaledYs) + Math.max(...scaledYs)) / 2;

    expect(scaledCenter).toBeCloseTo(baseCenter, 6);
    expect(Math.max(...scaledYs) - Math.min(...scaledYs)).toBeCloseTo(
      (Math.max(...baseYs) - Math.min(...baseYs)) * 0.5,
      6
    );
  });

  it('keeps the side root inside its side bounds while applying horizontal scaling', () => {
    const treeA = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const treeB = parseNewick('((A:1,C:1)AC:1,D:1)ROOT;').tree;
    const pairs = buildTanglegramPairs(treeA, treeB);
    const base = computeTanglegramLayout(treeA, treeB, pairs, defaultTanglegramRenderOptions());
    const scaled = computeTanglegramLayout(
      treeA,
      treeB,
      pairs,
      {
        ...defaultTanglegramRenderOptions(),
        layoutSpacingXB: 1.6,
      }
    );

    expect(scaled.sideB.nodes[0]).toBeDefined();
    const baseRootB = base.sideB.nodes.find((node) => node.parentId === null);
    const scaledRootB = scaled.sideB.nodes.find((node) => node.parentId === null);

    expect(baseRootB?.y).toBeCloseTo(scaledRootB?.y ?? 0, 6);
    expect((scaledRootB?.x ?? 0) - scaled.sideB.offsetX).toBeGreaterThanOrEqual(16);
    expect((scaledRootB?.x ?? 0) - scaled.sideB.offsetX).toBeLessThanOrEqual(scaled.sideB.width - 16);
  });

  it('keeps asymmetric rebuilt tanglegram sides within their own bounds under extreme scaling', () => {
    const treeA = parseNewick('((((A:0.1,B:2.4)AB:1.8,C:3.5)ABC:4.2,(D:0.4,E:5.6)DE:0.9,F:6.1)LEFT:1.3,G:2.1)ROOT;').tree;
    const treeB = parseNewick('(G:2.1,(F:6.1,(D:0.4,E:5.6)DE:0.9,(C:3.5,(B:2.4,A:0.1)AB:1.8)ABC:4.2)RIGHT:1.3)ROOT;').tree;
    const options = {
      ...defaultTanglegramRenderOptions(),
      useBranchLengthsA: true,
      useBranchLengthsB: true,
      layoutSpacingXA: 2.4,
      layoutSpacingYA: 0.1,
      layoutSpacingXB: 2.4,
      layoutSpacingYB: 3.4,
    };
    const pairs = buildTanglegramPairs(treeA, treeB);
    const layout = computeTanglegramLayout(treeA, treeB, pairs, options);

    const sideAMinX = layout.sideA.offsetX + 16;
    const sideAMaxX = layout.sideA.offsetX + layout.sideA.width - 16;
    const sideBMinX = layout.sideB.offsetX + 16;
    const sideBMaxX = layout.sideB.offsetX + layout.sideB.width - 16;

    expect(layout.sideA.nodes.every((node) => node.x >= sideAMinX && node.x <= sideAMaxX)).toBe(true);
    expect(layout.sideB.nodes.every((node) => node.x >= sideBMinX && node.x <= sideBMaxX)).toBe(true);
    expect(layout.sideA.nodes.every((node) => node.y >= 16 && node.y <= layout.height - 16)).toBe(true);
    expect(layout.sideB.nodes.every((node) => node.y >= 16 && node.y <= layout.height - 16)).toBe(true);
  });

  it('applies shared structural actions to a chosen tanglegram side', () => {
    const treeA = parseNewick('((A:1,B:1)AB:1,C:1)ROOT;').tree;
    const treeB = parseNewick('((A:1,C:1)AC:1,D:1)ROOT;').tree;
    const targetId = new PhyloTreeModel(treeA).findByName('AB')[0]?.id;

    expect(targetId).toBeTruthy();

    const updated = applyTanglegramSideTreeAction(
      { treeA, treeB },
      'A',
      { type: 'reroot', nodeId: targetId as string }
    );

    expect(updated.treeA.root.id).toBe(targetId);
    expect(updated.treeB.root.name).toBe(treeB.root.name);
  });

  it('applies shared view actions to a chosen tanglegram side', () => {
    const next = applyTanglegramSideViewAction(
      {
        viewStateA: ViewState.empty(),
        viewStateB: ViewState.empty(),
      },
      'B',
      { type: 'setColor', nodeId: 'node-42', color: '#ff006e' }
    );

    expect(next.viewStateA.getColor('node-42')).toBeNull();
    expect(next.viewStateB.getColor('node-42')).toBe('#ff006e');
  });
});
