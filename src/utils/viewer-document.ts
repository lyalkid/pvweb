import { PhyloTreeModel, parseAuto, type PhyloTree } from 'phylo-tree-lib';
import type { FileDto, FileContentDto } from '../lib/api';

export interface ViewerDocument {
  file: FileDto;
  rawText: string;
  tree: PhyloTree | null;
  error: string;
  warning: string;
  stats: {
    name: string;
    leaves: number;
    nodes: number;
  } | null;
}

function buildViewerDocument(file: FileDto, content: string): ViewerDocument {
  const parsed = parseViewerTree(content);
  return {
    file,
    rawText: content,
    tree: parsed.tree,
    error: parsed.error,
    warning: parsed.warning,
    stats: parsed.tree ? getTreeStats(parsed.tree) : null,
  };
}

export function buildViewerDocumentFromContent(fileContent: FileContentDto): ViewerDocument {
  const file: FileDto = {
    id: fileContent.id,
    name: fileContent.name,
    format: fileContent.format,
    treeCount: fileContent.treeCount,
    leafCount: fileContent.leafCount,
    sizeBytes: fileContent.sizeBytes,
    createdAt: fileContent.createdAt,
    updatedAt: fileContent.updatedAt,
  };
  return buildViewerDocument(file, fileContent.content);
}

function parseViewerTree(value: string): { tree: PhyloTree | null; warning: string; error: string } {
  try {
    const parsed = parseAuto(value.trim());
    return {
      tree: parsed.tree,
      warning: parsed.warnings[0] ?? '',
      error: '',
    };
  } catch (error) {
    return {
      tree: null,
      warning: '',
      error: error instanceof Error ? error.message : 'Не удалось распарсить дерево.',
    };
  }
}

function getTreeStats(tree: PhyloTree) {
  const model = new PhyloTreeModel(tree);
  return {
    name: tree.metadata.name ?? tree.root.name ?? 'Tree',
    leaves: tree.metadata.leafCount,
    nodes: model.nodes().length,
  };
}
