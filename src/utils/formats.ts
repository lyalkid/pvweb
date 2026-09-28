import type { FileDto } from '../lib/api';

const SUPPORTED_VIEWER_FORMATS = ['newick', 'nexus', 'phyloxml'] as const;

export function isViewerSupportedFormat(format: string | null | undefined): boolean {
  if (!format) {
    return false;
  }
  return SUPPORTED_VIEWER_FORMATS.includes(format.toLowerCase() as (typeof SUPPORTED_VIEWER_FORMATS)[number]);
}

export function filterViewerSupportedFiles(files: FileDto[]): FileDto[] {
  return files.filter((file) => isViewerSupportedFormat(file.format));
}
