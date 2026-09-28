import { describe, expect, it } from 'vitest';
import { parseNewick } from '../src/parsers/newick';

describe('parseNewick', () => {
  it('parses a basic tree and returns metadata', () => {
    const result = parseNewick('((A:1,B:2)AB:3,C:4)ROOT;');
    expect(result.tree.metadata.format).toBe('newick');
    expect(result.tree.metadata.leafCount).toBe(3);
    expect(result.tree.metadata.totalNodes).toBe(5);
    expect(result.tree.root.name).toBe('ROOT');
  });

  it('returns warning when semicolon is missing', () => {
    const result = parseNewick('(A:1,B:2)ROOT');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
