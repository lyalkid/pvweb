/**
 * Определение формата дерева и подсчёт листьев.
 *
 * Перенос с сервера (apps/backend/app/services/tree_content.py прежнего проекта)
 * один в один, чтобы поля format и leafCount совпадали со старой базой.
 */

import { ApiError } from './api-error';

const NEWICK_EXTENSIONS = ['.nwk', '.newick', '.tre', '.tree', '.txt'];
const NEXUS_EXTENSIONS = ['.nex', '.nexus'];
const PHYLOXML_EXTENSIONS = ['.phyloxml', '.xml'];

export type TreeFormat = 'newick' | 'nexus' | 'phyloxml';

function badRequest(message: string): ApiError {
  return new ApiError(message, 400, { message });
}

export function detectXmlFamily(content: string): TreeFormat {
  const lowered = content.toLowerCase();
  if (lowered.includes('<phyloxml') || lowered.includes('<phylogeny')) {
    return 'phyloxml';
  }
  throw badRequest('Unsupported XML tree format. Only PhyloXML XML documents are supported.');
}

export function detectFormat(filename: string, content: string): TreeFormat {
  const lowered = filename.toLowerCase();

  if (NEWICK_EXTENSIONS.some((extension) => lowered.endsWith(extension))) {
    return 'newick';
  }
  if (NEXUS_EXTENSIONS.some((extension) => lowered.endsWith(extension))) {
    return 'nexus';
  }
  if (PHYLOXML_EXTENSIONS.some((extension) => lowered.endsWith(extension))) {
    return detectXmlFamily(content);
  }

  const stripped = content.trim();
  if (stripped.toLowerCase().startsWith('#nexus')) {
    return 'nexus';
  }
  if (stripped.startsWith('<')) {
    return detectXmlFamily(stripped);
  }
  if (stripped.endsWith(';') && stripped.includes('(') && stripped.includes(')')) {
    return 'newick';
  }

  throw badRequest('Unsupported tree format. Supported inputs are Newick, NEXUS, and PhyloXML.');
}

export function countLeaves(content: string, detectedFormat?: TreeFormat | null): number | null {
  const format = detectedFormat ?? detectFormat('untitled.tree', content);
  if (format !== 'newick') {
    return null;
  }

  // Пробелы удалены целиком, поэтому предыдущий значащий символ — это просто text[start - 1].
  const text = content.trim().replace(/\s/g, '');
  if (!text.endsWith(';')) {
    return null;
  }

  let leaves = 0;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (ch === '(' || ch === ')' || ch === ',' || ch === ';') {
      i += 1;
      continue;
    }

    if (ch === ':') {
      i += 1;
      while (i < n && text[i] !== ',' && text[i] !== ')' && text[i] !== ';') {
        i += 1;
      }
      continue;
    }

    const start = i;
    while (i < n && !':,();'.includes(text[i])) {
      i += 1;
    }

    const token = text.slice(start, i);
    const previous = start > 0 ? text[start - 1] : null;
    if (token && previous !== ')') {
      leaves += 1;
    }
  }

  return leaves || null;
}
