import { PhyloParseError } from '../errors';
import type { ParseResult, PhyloNode } from '../tree/types';
import { buildTreeFromRoot } from './parser-utils';

interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

interface XmlFrame extends XmlNode {
  selfClosing: boolean;
}

export function parsePhyloXML(content: string): ParseResult {
  const input = content.trim();
  if (!input) {
    throw new PhyloParseError('Empty PhyloXML input');
  }

  const xmlRoot = parseXml(input);
  const phylogeny = findFirstNode(xmlRoot, 'phylogeny');
  if (!phylogeny) {
    throw new PhyloParseError('PhyloXML input does not contain a phylogeny element');
  }

  const clade = phylogeny.children.find((child) => child.name === 'clade');
  if (!clade) {
    throw new PhyloParseError('PhyloXML phylogeny does not contain a root clade');
  }

  let nextId = 0;
  const root = parseClade(clade, () => {
    nextId += 1;
    return `n${nextId}`;
  });

  const rootedAttr = phylogeny.attributes.rooted?.toLowerCase();
  const tree = buildTreeFromRoot(root, 'phyloxml', {
    isRooted: rootedAttr ? rootedAttr === 'true' || rootedAttr === '1' : true,
    name: readChildText(phylogeny, 'name') ?? root.name,
  });

  return {
    tree,
    warnings: [],
  };
}

function parseClade(node: XmlNode, nextId: () => string): PhyloNode {
  const childClades = node.children.filter((child) => child.name === 'clade');
  const confidenceNode = node.children.find((child) => child.name === 'confidence');
  const branchLengthText =
    readChildText(node, 'branch_length') ?? node.attributes.branch_length ?? null;

  return {
    id: nextId(),
    name: readChildText(node, 'name'),
    branchLength: branchLengthText === null ? null : parseOptionalNumber(branchLengthText),
    confidence: confidenceNode ? parseOptionalNumber(confidenceNode.text) : null,
    children: childClades.map((child) => parseClade(child, nextId)),
    annotations: {},
  };
}

function parseOptionalNumber(value: string): number | null {
  const text = value.trim();
  if (!text) {
    return null;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new PhyloParseError(`Invalid numeric value '${value}' in PhyloXML`);
  }

  return parsed;
}

function readChildText(node: XmlNode, childName: string): string | null {
  const child = node.children.find((entry) => entry.name === childName);
  if (!child) {
    return null;
  }

  const text = child.text.trim();
  return text.length > 0 ? text : null;
}

function findFirstNode(root: XmlNode, name: string): XmlNode | null {
  if (root.name === name) {
    return root;
  }

  for (const child of root.children) {
    const found = findFirstNode(child, name);
    if (found) {
      return found;
    }
  }

  return null;
}

function parseXml(input: string): XmlNode {
  const tokens = tokenizeXml(input);
  const stack: XmlFrame[] = [];
  let root: XmlNode | null = null;

  for (const token of tokens) {
    if (token.kind === 'text') {
      if (stack.length > 0) {
        stack[stack.length - 1].text += token.value;
      }
      continue;
    }

    if (token.kind === 'open') {
      const frame: XmlFrame = {
        name: token.name,
        attributes: token.attributes,
        children: [],
        text: '',
        selfClosing: token.selfClosing,
      };

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(frame);
      } else if (!root) {
        root = frame;
      } else {
        throw new PhyloParseError('Invalid XML: multiple root elements');
      }

      if (!token.selfClosing) {
        stack.push(frame);
      }
      continue;
    }

    const current = stack.pop();
    if (!current || current.name !== token.name) {
      throw new PhyloParseError(`Invalid XML: unexpected closing tag </${token.name}>`);
    }
  }

  if (stack.length > 0) {
    throw new PhyloParseError('Invalid XML: unclosed tags remain');
  }

  if (!root) {
    throw new PhyloParseError('Invalid XML: empty document');
  }

  return root;
}

function tokenizeXml(input: string): Array<
  | { kind: 'text'; value: string }
  | { kind: 'open'; name: string; attributes: Record<string, string>; selfClosing: boolean }
  | { kind: 'close'; name: string }
> {
  const tokens: Array<
    | { kind: 'text'; value: string }
    | { kind: 'open'; name: string; attributes: Record<string, string>; selfClosing: boolean }
    | { kind: 'close'; name: string }
  > = [];

  const regex = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?]]>|<\/?[^>]+>|[^<]+/g;

  for (const match of input.matchAll(regex)) {
    const chunk = match[0];
    if (!chunk) {
      continue;
    }

    if (chunk.startsWith('<!--') || chunk.startsWith('<?')) {
      continue;
    }

    if (chunk.startsWith('<![CDATA[')) {
      tokens.push({ kind: 'text', value: chunk.slice(9, -3) });
      continue;
    }

    if (chunk.startsWith('</')) {
      tokens.push({
        kind: 'close',
        name: normalizeXmlName(chunk.slice(2, -1).trim()),
      });
      continue;
    }

    if (chunk.startsWith('<')) {
      const raw = chunk.slice(1, -1).trim();
      const selfClosing = raw.endsWith('/');
      const body = selfClosing ? raw.slice(0, -1).trim() : raw;
      const spaceIndex = body.search(/\s/);
      const rawName = spaceIndex === -1 ? body : body.slice(0, spaceIndex);
      const rawAttributes = spaceIndex === -1 ? '' : body.slice(spaceIndex + 1);
      tokens.push({
        kind: 'open',
        name: normalizeXmlName(rawName),
        attributes: parseXmlAttributes(rawAttributes),
        selfClosing,
      });
      continue;
    }

    tokens.push({ kind: 'text', value: decodeXmlEntities(chunk) });
  }

  return tokens;
}

function parseXmlAttributes(input: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

  for (const match of input.matchAll(regex)) {
    const key = normalizeXmlName(match[1]);
    const value = decodeXmlEntities(match[3] ?? match[4] ?? '');
    attributes[key] = value;
  }

  return attributes;
}

function normalizeXmlName(name: string): string {
  const trimmed = name.trim();
  const colonIndex = trimmed.indexOf(':');
  return colonIndex === -1 ? trimmed : trimmed.slice(colonIndex + 1);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
