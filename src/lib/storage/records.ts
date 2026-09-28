/**
 * Записи локальной базы. Поля повторяют колонки прежних таблиц PostgreSQL,
 * поэтому резервная копия остаётся читаемой и сопоставимой со старой схемой.
 */

export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  projectId: string;
  name: string;
  sourceType: 'file' | 'manual';
  sourceFormat: string;
  originalContent: string;
  workingNewick: string | null;
  treeCount: number;
  leafCount: number | null;
  sizeBytes: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ViewStateRecord {
  treeDocumentId: string;
  projectId: string;
  viewStateJson: Record<string, unknown>;
  renderOptionsJson: Record<string, unknown>;
  selectedNodeId: string | null;
  updatedAt: string;
}

export interface TanglegramStateRecord {
  projectId: string;
  treeAId: string | null;
  treeBId: string | null;
  stateJson: Record<string, unknown>;
  renderOptionsJson: Record<string, unknown>;
  updatedAt: string;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Запасной вариант для браузеров без randomUUID (в том числе на http-хостах).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Длина содержимого в байтах UTF-8: прежний бэкенд считал size_bytes именно так. */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
