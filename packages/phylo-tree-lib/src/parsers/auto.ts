import type { ParseResult } from '../tree/types';
import { parseNexus } from './nexus';
import { parseNewick } from './newick';
import { parsePhyloXML } from './phyloxml';

export function parseAuto(content: string): ParseResult {
  const input = content.trim();
  if (/^#?nexus\b/i.test(input)) {
    return parseNexus(input);
  }
  if (/^</.test(input) && /<(?:\w+:)?phyloxml\b|<(?:\w+:)?phylogeny\b/i.test(input)) {
    return parsePhyloXML(input);
  }
  return parseNewick(content);
}
