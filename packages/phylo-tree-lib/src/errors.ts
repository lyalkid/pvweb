export class PhyloParseError extends Error {
  readonly line?: number;
  readonly column?: number;

  constructor(message: string, options?: { line?: number; column?: number }) {
    super(message);
    this.name = 'PhyloParseError';
    this.line = options?.line;
    this.column = options?.column;
  }
}
