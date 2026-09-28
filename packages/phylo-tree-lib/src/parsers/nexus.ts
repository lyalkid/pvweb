import { PhyloParseError } from '../errors';
import type { ParseResult } from '../tree/types';
import { parseNewick } from './newick';

export function parseNexus(content: string): ParseResult {
  const input = content.trim();
  if (!input) {
    throw new PhyloParseError('Empty NEXUS input');
  }

  const treesBlock = extractTreesBlock(input);
  const warnings: string[] = [];
  const translateMap = parseTranslateMap(treesBlock);
  const treeDefinitions = extractTreeDefinitions(treesBlock);

  if (treeDefinitions.length === 0) {
    throw new PhyloParseError('NEXUS TREES block does not contain any tree definition');
  }

  if (treeDefinitions.length > 1) {
    warnings.push('Multiple trees detected in NEXUS input; only the first tree was loaded');
  }

  const normalizedNewick = applyTranslateMap(treeDefinitions[0], translateMap);
  const parsed = parseNewick(normalizedNewick);

  return {
    tree: {
      ...parsed.tree,
      metadata: {
        ...parsed.tree.metadata,
        format: 'nexus',
      },
    },
    warnings: [...warnings, ...parsed.warnings],
  };
}

function extractTreesBlock(input: string): string {
  const match = /begin\s+trees\s*;([\s\S]*?)end\s*;/i.exec(input);
  if (!match) {
    throw new PhyloParseError('NEXUS input does not contain a TREES block');
  }

  return match[1];
}

function extractTreeDefinitions(block: string): string[] {
  const definitions: string[] = [];
  const treeRegex = /\btree\b[\s\S]*?=\s*([\s\S]*?;)/gi;

  for (const match of block.matchAll(treeRegex)) {
    let newick = match[1].trim();
    newick = newick.replace(/^\[\s*&[^\]]*]/i, '').trim();
    if (newick.length > 0) {
      definitions.push(newick);
    }
  }

  return definitions;
}

function parseTranslateMap(block: string): Map<string, string> {
  const match = /\btranslate\b([\s\S]*?);/i.exec(block);
  const result = new Map<string, string>();
  if (!match) {
    return result;
  }

  const body = match[1];
  const entries = splitTranslateEntries(body);
  for (const entry of entries) {
    const parsed = parseTranslateEntry(entry);
    if (parsed) {
      result.set(parsed.key, parsed.value);
    }
  }

  return result;
}

function splitTranslateEntries(body: string): string[] {
  const entries: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === "'") {
      current += char;
      if (body[i + 1] === "'") {
        current += "'";
        i += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }

    if (char === ',' && !inQuote) {
      if (current.trim()) {
        entries.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    entries.push(current.trim());
  }

  return entries;
}

function parseTranslateEntry(entry: string): { key: string; value: string } | null {
  const match = /^(\S+)\s+(.+)$/.exec(entry.trim());
  if (!match) {
    return null;
  }

  return {
    key: match[1],
    value: unquoteLabel(match[2].trim()),
  };
}

function applyTranslateMap(newick: string, translateMap: Map<string, string>): string {
  if (translateMap.size === 0) {
    return newick;
  }

  let result = '';
  let i = 0;

  while (i < newick.length) {
    const char = newick[i];
    result += char;
    i += 1;

    if (char !== '(' && char !== ',') {
      continue;
    }

    while (i < newick.length && /\s/.test(newick[i])) {
      result += newick[i];
      i += 1;
    }

    if (i >= newick.length || newick[i] === "'" || newick[i] === '(' || newick[i] === ')') {
      continue;
    }

    const start = i;
    while (i < newick.length && ![':', ',', ')', ';', '['].includes(newick[i])) {
      i += 1;
    }
    const rawLabel = newick.slice(start, i).trim();

    if (!rawLabel) {
      result += newick.slice(start, i);
      continue;
    }

    const replacement = translateMap.get(rawLabel);
    result += replacement ? quoteIfNeeded(replacement) : rawLabel;
  }

  return result;
}

function unquoteLabel(label: string): string {
  if (label.startsWith("'") && label.endsWith("'")) {
    return label.slice(1, -1).replace(/''/g, "'");
  }
  return label;
}

function quoteIfNeeded(label: string): string {
  if (!/[\s,:;()[\]']/.test(label)) {
    return label;
  }
  return `'${label.replace(/'/g, "''")}'`;
}
