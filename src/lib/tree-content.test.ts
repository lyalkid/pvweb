import { describe, expect, it } from 'vitest';
import { countLeaves, detectFormat, type TreeFormat } from './tree-content';
import { ApiError } from './api-error';
import cases from './__fixtures__/content-cases.json';

/**
 * Эталоны сняты с серверной реализации на Python
 * (apps/backend/app/services/tree_content.py прежнего проекта).
 */

interface ContentCase {
  filename: string;
  content: string;
  format?: string;
  formatError?: string;
  leafCount?: number | null;
}

const contentCases = cases as ContentCase[];

describe('detectFormat и countLeaves', () => {
  it.each(contentCases.map((item, index) => [index, item] as const))(
    'случай %i совпадает с серверным результатом',
    (_index, item) => {
      if (item.formatError !== undefined) {
        expect(() => detectFormat(item.filename, item.content)).toThrow(item.formatError);
        return;
      }

      const format = detectFormat(item.filename, item.content);
      expect(format).toBe(item.format);
      expect(countLeaves(item.content, format as TreeFormat)).toBe(item.leafCount ?? null);
    }
  );

  it('неопознанный формат даёт ошибку 400', () => {
    expect(() => detectFormat('mystery', 'совершенно не дерево')).toThrow(ApiError);
    try {
      detectFormat('mystery', 'совершенно не дерево');
    } catch (error) {
      expect((error as ApiError).status).toBe(400);
    }
  });

  it('XML без филогении отвергается', () => {
    expect(() => detectFormat('doc.xml', '<html><body/></html>')).toThrow(
      'Unsupported XML tree format'
    );
  });

  it('листья считаются только для Newick', () => {
    expect(countLeaves('#NEXUS\nbegin trees;', 'nexus')).toBeNull();
  });
});
