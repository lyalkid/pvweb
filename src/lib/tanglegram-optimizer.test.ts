import { describe, expect, it } from 'vitest';
import { optimizeTanglegram } from './tanglegram-optimizer';
import cases from './__fixtures__/greedy-cases.json';

/**
 * Эталоны сняты с серверной реализации на Python
 * (apps/backend/app/services/tanglegram_optimizer.py прежнего проекта) режимом
 * greedy. Совпадение подтверждает, что порт не изменил поведение оптимизатора.
 */

interface GreedyCase {
  left: string;
  right: string;
  expected?: {
    initialCrossings: number;
    finalCrossings: number;
    stepsUsed: number;
    actions: number[];
    matchedLeafCount: number;
    nLeaves: number;
    maxSteps: number;
    optimizedTreeA: string;
    optimizedTreeB: string;
  };
}

const greedyCases = cases as GreedyCase[];

describe('optimizeTanglegram, режим greedy', () => {
  it('набор эталонов не пуст', () => {
    expect(greedyCases.length).toBeGreaterThan(0);
    expect(greedyCases.every((item) => item.expected !== undefined)).toBe(true);
  });

  it.each(greedyCases.map((item, index) => [index, item] as const))(
    'случай %i совпадает с серверным результатом',
    (_index, item) => {
      const expected = item.expected!;
      const result = optimizeTanglegram(item.left, item.right, {
        mode: 'greedy',
        maxLeaves: 256,
        includeActions: true,
      });

      expect(result.initialCrossings).toBe(expected.initialCrossings);
      expect(result.finalCrossings).toBe(expected.finalCrossings);
      expect(result.stepsUsed).toBe(expected.stepsUsed);
      expect(result.actions).toEqual(expected.actions);
      expect(result.matchedLeafCount).toBe(expected.matchedLeafCount);
      expect(result.nLeaves).toBe(expected.nLeaves);
      expect(result.maxSteps).toBe(expected.maxSteps);
      expect(result.optimizedTreeA.newick).toBe(expected.optimizedTreeA);
      expect(result.optimizedTreeB.newick).toBe(expected.optimizedTreeB);
    }
  );

  it('оптимизация не увеличивает число пересечений', () => {
    for (const item of greedyCases) {
      const result = optimizeTanglegram(item.left, item.right, { mode: 'greedy', maxLeaves: 256 });
      expect(result.finalCrossings).toBeLessThanOrEqual(result.initialCrossings);
    }
  });
});
