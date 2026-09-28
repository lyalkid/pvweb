/**
 * Оптимизация танглограммы жадным алгоритмом.
 *
 * Перенос с сервера (apps/backend/app/services/tanglegram_optimizer.py прежнего
 * проекта). Режимы rl и beam требовали PPO-моделей PyTorch, step2side и
 * stepBothSides — рантайма R с пакетом dendextend, shuntan — scipy. В браузере
 * ни одного из них нет, поэтому здесь остались auto и greedy.
 *
 * Результат жадного режима совпадает с серверным: тот же порядок обхода узлов,
 * тот же критерий выбора действия, та же остановка.
 */

export class TanglegramInputError extends Error {}
export class TanglegramConstraintError extends Error {}

export type TanglegramOptimizeMode = 'auto' | 'greedy';
export type TanglegramOptimizeMethod = 'greedy' | 'greedy_fallback';

/**
 * Прежний сервер ограничивал размер 64 листьями, потому что PPO-модели были
 * обучены на 8, 16, 32 и 64. Без моделей ограничение держит только время
 * счёта, поэтому порог поднят. Жадный проход имеет сложность порядка O(n^3).
 */
export const DEFAULT_MAX_LEAVES = 256;

export interface OptimizationOptions {
  mode: TanglegramOptimizeMode;
  maxLeaves: number;
  maxSteps: number | null;
  includeActions: boolean;
}

export function defaultOptimizationOptions(): OptimizationOptions {
  return { mode: 'auto', maxLeaves: DEFAULT_MAX_LEAVES, maxSteps: null, includeActions: false };
}

interface TreeNode {
  label: string | null;
  serializedLeaf: string | null;
  internalSuffix: string;
  children: TreeNode[];
}

interface Tanglegram {
  left: TreeNode;
  right: TreeNode;
}

function makeNode(partial: Partial<TreeNode>): TreeNode {
  return {
    label: partial.label ?? null,
    serializedLeaf: partial.serializedLeaf ?? null,
    internalSuffix: partial.internalSuffix ?? '',
    children: partial.children ?? [],
  };
}

function isLeaf(node: TreeNode): boolean {
  return node.children.length === 0;
}

function collectLeaves(node: TreeNode, into: TreeNode[] = []): TreeNode[] {
  if (isLeaf(node)) {
    into.push(node);
    return into;
  }
  for (const child of node.children) {
    collectLeaves(child, into);
  }
  return into;
}

/** Обход в прямом порядке: корень, затем поддеревья. Совпадает с серверным. */
function collectInternalNodes(node: TreeNode, into: TreeNode[] = []): TreeNode[] {
  if (isLeaf(node)) {
    return into;
  }
  into.push(node);
  for (const child of node.children) {
    collectInternalNodes(child, into);
  }
  return into;
}

function leafOrder(root: TreeNode): string[] {
  return collectLeaves(root).map((leaf) => leaf.label ?? '');
}

function toNewick(root: TreeNode): string {
  if (isLeaf(root)) {
    return root.serializedLeaf ?? String(root.label);
  }
  const children = root.children.map(toNewick).join(',');
  return `(${children})${root.internalSuffix}`;
}

function serializeTree(root: TreeNode): string {
  return `${toNewick(root)};`;
}

function isBinary(node: TreeNode): boolean {
  return isLeaf(node) || (node.children.length === 2 && node.children.every(isBinary));
}

function cloneNode(node: TreeNode): TreeNode {
  return {
    label: node.label,
    serializedLeaf: node.serializedLeaf,
    internalSuffix: node.internalSuffix,
    children: node.children.map(cloneNode),
  };
}

function cloneTanglegram(tanglegram: Tanglegram): Tanglegram {
  return { left: cloneNode(tanglegram.left), right: cloneNode(tanglegram.right) };
}

function leafLabel(serializedLeaf: string): string {
  const label = serializedLeaf.split(':', 1)[0].trim();
  if (!label) {
    throw new TanglegramInputError('Newick leaf label is required');
  }
  return label;
}

export function parseNewick(newick: string): TreeNode {
  const trimmed = newick.trim();
  if (!trimmed.endsWith(';')) {
    throw new TanglegramInputError("Newick string must end with ';'");
  }
  const text = trimmed.slice(0, -1);
  let index = 0;

  function skipWhitespace(): void {
    while (index < text.length && /\s/.test(text[index])) {
      index += 1;
    }
  }

  function readUntilDelimiter(): string {
    const start = index;
    while (index < text.length && !',()'.includes(text[index])) {
      index += 1;
    }
    return text.slice(start, index).trim();
  }

  function parseNode(): TreeNode {
    skipWhitespace();
    if (index >= text.length) {
      throw new TanglegramInputError('Unexpected end of Newick string');
    }

    if (text[index] === '(') {
      index += 1;
      const children = [parseNode()];
      for (;;) {
        skipWhitespace();
        if (index >= text.length) {
          throw new TanglegramInputError("Expected ',' or ')' in Newick tree");
        }
        if (text[index] === ',') {
          index += 1;
          children.push(parseNode());
          continue;
        }
        if (text[index] === ')') {
          index += 1;
          return makeNode({ children, internalSuffix: readUntilDelimiter() });
        }
        throw new TanglegramInputError("Expected ',' or ')' in Newick tree");
      }
    }

    const serializedLeaf = readUntilDelimiter();
    if (!serializedLeaf) {
      throw new TanglegramInputError('Empty leaf in Newick tree');
    }
    return makeNode({ label: leafLabel(serializedLeaf), serializedLeaf });
  }

  const root = parseNode();
  skipWhitespace();
  if (index !== text.length) {
    throw new TanglegramInputError('Unexpected trailing content in Newick string');
  }
  return root;
}

function parseTanglegram(leftNewick: string, rightNewick: string): Tanglegram {
  const tanglegram: Tanglegram = { left: parseNewick(leftNewick), right: parseNewick(rightNewick) };
  const leftLabels = leafOrder(tanglegram.left);
  const rightLabels = leafOrder(tanglegram.right);
  if (
    new Set(leftLabels).size !== leftLabels.length ||
    new Set(rightLabels).size !== rightLabels.length
  ) {
    throw new TanglegramInputError('Each leaf label must occur exactly once in each tree');
  }
  return tanglegram;
}

function matchedLabels(tanglegram: Tanglegram): Set<string> {
  const right = new Set(leafOrder(tanglegram.right));
  return new Set(leafOrder(tanglegram.left).filter((label) => right.has(label)));
}

function hasCompleteMatching(tanglegram: Tanglegram): boolean {
  const left = leafOrder(tanglegram.left);
  const right = new Set(leafOrder(tanglegram.right));
  return left.length === right.size && left.every((label) => right.has(label));
}

function countInversions(values: number[]): number {
  let inversions = 0;
  for (let first = 0; first < values.length; first += 1) {
    for (let second = first + 1; second < values.length; second += 1) {
      if (values[first] > values[second]) {
        inversions += 1;
      }
    }
  }
  return inversions;
}

function countCrossings(tanglegram: Tanglegram): number {
  const matched = matchedLabels(tanglegram);
  const rightPositions = new Map<string, number>();
  leafOrder(tanglegram.right).forEach((label, index) => {
    if (matched.has(label)) {
      rightPositions.set(label, index);
    }
  });

  const permutation: number[] = [];
  for (const label of leafOrder(tanglegram.left)) {
    if (matched.has(label)) {
      permutation.push(rightPositions.get(label)!);
    }
  }
  return countInversions(permutation);
}

function pairCrossings(first: number[], second: number[]): number {
  let total = 0;
  for (const a of first) {
    for (const b of second) {
      if (a > b) {
        total += 1;
      }
    }
  }
  return total;
}

/**
 * Изменение числа пересечений при перевороте детей узла, в «сыром» виде:
 * положительное значение означает выигрыш. positions передаётся снаружи, потому
 * что в пределах одного шага противоположное дерево не меняется.
 */
function rawFlipGain(node: TreeNode, positions: Map<string, number>): number {
  if (node.children.length < 2) {
    return 0;
  }

  const childPositions = node.children.map((child) =>
    collectLeaves(child)
      .map((leaf) => positions.get(leaf.label ?? ''))
      .filter((position): position is number => position !== undefined)
  );

  let localCrossings = 0;
  let crossChildPairs = 0;
  for (let first = 0; first < childPositions.length; first += 1) {
    for (let second = first + 1; second < childPositions.length; second += 1) {
      localCrossings += pairCrossings(childPositions[first], childPositions[second]);
      crossChildPairs += childPositions[first].length * childPositions[second].length;
    }
  }
  return 2 * localCrossings - crossChildPairs;
}

function positionsOf(root: TreeNode): Map<string, number> {
  const positions = new Map<string, number>();
  leafOrder(root).forEach((label, index) => positions.set(label, index));
  return positions;
}

function applyAction(tanglegram: Tanglegram, action: number): void {
  const leftInternal = collectInternalNodes(tanglegram.left);
  const rightInternal = collectInternalNodes(tanglegram.right);
  if (action >= leftInternal.length + rightInternal.length) {
    return;
  }
  const nodes = action < leftInternal.length ? leftInternal : rightInternal;
  const nodeIndex = action < leftInternal.length ? action : action - leftInternal.length;
  if (nodeIndex >= 0 && nodeIndex < nodes.length) {
    nodes[nodeIndex].children.reverse();
  }
}

function relativeImprovement(initial: number, final: number): number {
  return initial > 0 ? (initial - final) / initial : 0;
}

interface GreedyOutcome {
  initialCrossings: number;
  finalCrossings: number;
  stepsUsed: number;
  actions: number[];
  runtimeSec: number;
  tanglegram: Tanglegram;
}

function optimizeGreedy(base: Tanglegram, maxSteps: number): GreedyOutcome {
  const start = performance.now();
  const tanglegram = cloneTanglegram(base);
  const initial = countCrossings(tanglegram);
  const actions: number[] = [];

  for (let step = 0; step < maxSteps; step += 1) {
    const leftInternal = collectInternalNodes(tanglegram.left);
    const rightInternal = collectInternalNodes(tanglegram.right);
    // Позиции берутся из противоположного дерева и в пределах шага не меняются.
    const positionsForLeft = positionsOf(tanglegram.right);
    const positionsForRight = positionsOf(tanglegram.left);

    let bestGain = 0;
    let bestAction: number | null = null;

    leftInternal.forEach((node, index) => {
      const gain = rawFlipGain(node, positionsForLeft);
      if (gain > bestGain) {
        bestGain = gain;
        bestAction = index;
      }
    });
    rightInternal.forEach((node, index) => {
      const gain = rawFlipGain(node, positionsForRight);
      if (gain > bestGain) {
        bestGain = gain;
        bestAction = leftInternal.length + index;
      }
    });

    if (bestAction === null || bestGain <= 0) {
      break;
    }

    applyAction(tanglegram, bestAction);
    actions.push(bestAction);
  }

  return {
    initialCrossings: initial,
    finalCrossings: countCrossings(tanglegram),
    stepsUsed: actions.length,
    actions,
    runtimeSec: (performance.now() - start) / 1000,
    tanglegram,
  };
}

export interface OptimizedTree {
  newick: string;
  leafCount: number;
}

export interface TanglegramOptimizationResult {
  requestedMode: TanglegramOptimizeMode;
  effectiveMode: TanglegramOptimizeMethod;
  method: TanglegramOptimizeMethod;
  nLeaves: number;
  leftLeafCount: number;
  rightLeafCount: number;
  matchedLeafCount: number;
  maxLeaves: number;
  maxSteps: number;
  initialCrossings: number;
  finalCrossings: number;
  bestCrossings: number;
  absoluteImprovement: number;
  relativeImprovement: number;
  bestRelativeImprovement: number;
  stepsUsed: number;
  runtimeSec: number;
  stopReason: string;
  warnings: string[];
  optimizedTreeA: OptimizedTree;
  optimizedTreeB: OptimizedTree;
  actions: number[] | null;
}

export function optimizeTanglegram(
  leftNewick: string,
  rightNewick: string,
  overrides: Partial<OptimizationOptions> = {}
): TanglegramOptimizationResult {
  const options: OptimizationOptions = { ...defaultOptimizationOptions(), ...overrides };
  const tanglegram = parseTanglegram(leftNewick, rightNewick);

  const leftLeafCount = leafOrder(tanglegram.left).length;
  const rightLeafCount = leafOrder(tanglegram.right).length;
  const matchedLeafCount = matchedLabels(tanglegram).size;
  const nLeaves = Math.max(leftLeafCount, rightLeafCount);

  if (leftLeafCount < 2 || rightLeafCount < 2) {
    throw new TanglegramInputError('Tanglegram must contain at least two leaves');
  }
  if (nLeaves > options.maxLeaves) {
    throw new TanglegramConstraintError(`n_leaves=${nLeaves} exceeds max_leaves=${options.maxLeaves}`);
  }
  if (options.mode !== 'auto' && options.mode !== 'greedy') {
    throw new TanglegramConstraintError(`Unsupported optimizer mode: ${String(options.mode)}`);
  }
  if (options.maxSteps !== null && options.maxSteps < 1) {
    throw new TanglegramConstraintError('max_steps must be greater than zero');
  }

  const maxSteps = options.maxSteps ?? Math.max(1, 2 * (nLeaves - 1));
  const warnings: string[] = [];

  if (!hasCompleteMatching(tanglegram)) {
    warnings.push(
      `Optimized crossings for ${matchedLeafCount} shared leaf labels; ` +
        'unmatched leaves are excluded from crossing count'
    );
  }
  if (options.mode === 'auto' && !(isBinary(tanglegram.left) && isBinary(tanglegram.right))) {
    warnings.push('Non-binary tree topology detected; greedy handles polytomies directly');
  }

  const method: TanglegramOptimizeMethod = options.mode === 'auto' ? 'greedy_fallback' : 'greedy';
  const outcome = optimizeGreedy(tanglegram, maxSteps);
  const improvement = relativeImprovement(outcome.initialCrossings, outcome.finalCrossings);

  return {
    requestedMode: options.mode,
    effectiveMode: method,
    method,
    nLeaves,
    leftLeafCount,
    rightLeafCount,
    matchedLeafCount,
    maxLeaves: options.maxLeaves,
    maxSteps,
    initialCrossings: outcome.initialCrossings,
    finalCrossings: outcome.finalCrossings,
    bestCrossings: outcome.finalCrossings,
    absoluteImprovement: outcome.initialCrossings - outcome.finalCrossings,
    relativeImprovement: improvement,
    bestRelativeImprovement: improvement,
    stepsUsed: outcome.stepsUsed,
    runtimeSec: outcome.runtimeSec,
    stopReason: 'local_optimum_or_zero_or_max_steps',
    warnings,
    optimizedTreeA: { newick: serializeTree(outcome.tanglegram.left), leafCount: leftLeafCount },
    optimizedTreeB: { newick: serializeTree(outcome.tanglegram.right), leafCount: rightLeafCount },
    actions: options.includeActions ? outcome.actions : null,
  };
}
