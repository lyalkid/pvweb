/**
 * Экспорт и импорт локальной базы одним JSON-файлом.
 *
 * В прежнем проекте данные лежали в PostgreSQL и их можно было снять
 * через pg_dump. Здесь база находится в браузере: её стирает очистка данных
 * сайта, и она не переезжает на другую машину сама. Резервная копия закрывает
 * обе дыры и заодно служит способом перенести проекты между браузерами.
 */

import {
  runTransaction,
  storeClear,
  storeGetAll,
  storePut,
  STORE_DOCUMENTS,
  STORE_PROJECTS,
  STORE_TANGLEGRAM_STATES,
  STORE_VIEW_STATES,
} from './storage/db';
import type {
  DocumentRecord,
  ProjectRecord,
  TanglegramStateRecord,
  ViewStateRecord,
} from './storage/records';

export const BACKUP_FORMAT = 'phylo-viewer-backup';
export const BACKUP_VERSION = 1;

export interface BackupPayload {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  projects: ProjectRecord[];
  documents: DocumentRecord[];
  viewStates: ViewStateRecord[];
  tanglegramStates: TanglegramStateRecord[];
}

export async function exportBackup(): Promise<BackupPayload> {
  return runTransaction(
    [STORE_PROJECTS, STORE_DOCUMENTS, STORE_VIEW_STATES, STORE_TANGLEGRAM_STATES],
    'readonly',
    async (tx) => ({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      projects: await storeGetAll<ProjectRecord>(tx, STORE_PROJECTS),
      documents: await storeGetAll<DocumentRecord>(tx, STORE_DOCUMENTS),
      viewStates: await storeGetAll<ViewStateRecord>(tx, STORE_VIEW_STATES),
      tanglegramStates: await storeGetAll<TanglegramStateRecord>(tx, STORE_TANGLEGRAM_STATES),
    })
  );
}

export function downloadBackup(payload: BackupPayload): void {
  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `phylo-viewer-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null);
}

export function parseBackup(raw: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Файл не является корректным JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Файл не похож на резервную копию');
  }

  const candidate = parsed as Partial<BackupPayload>;
  if (candidate.format !== BACKUP_FORMAT) {
    throw new Error('Файл не является резервной копией Phylo Viewer');
  }
  if (candidate.version !== BACKUP_VERSION) {
    throw new Error(`Версия копии ${String(candidate.version)} не поддерживается`);
  }
  if (
    !isRecordArray(candidate.projects) ||
    !isRecordArray(candidate.documents) ||
    !isRecordArray(candidate.viewStates) ||
    !isRecordArray(candidate.tanglegramStates)
  ) {
    throw new Error('В резервной копии не хватает разделов данных');
  }

  return candidate as BackupPayload;
}

/**
 * Полностью заменяет содержимое локальной базы. Вызывающий код обязан
 * предупредить пользователя: текущие проекты будут потеряны.
 */
export async function importBackup(payload: BackupPayload): Promise<void> {
  await runTransaction(
    [STORE_PROJECTS, STORE_DOCUMENTS, STORE_VIEW_STATES, STORE_TANGLEGRAM_STATES],
    'readwrite',
    async (tx) => {
      await storeClear(tx, STORE_PROJECTS);
      await storeClear(tx, STORE_DOCUMENTS);
      await storeClear(tx, STORE_VIEW_STATES);
      await storeClear(tx, STORE_TANGLEGRAM_STATES);

      for (const project of payload.projects) {
        await storePut(tx, STORE_PROJECTS, project);
      }
      for (const document of payload.documents) {
        await storePut(tx, STORE_DOCUMENTS, document);
      }
      for (const state of payload.viewStates) {
        await storePut(tx, STORE_VIEW_STATES, state);
      }
      for (const state of payload.tanglegramStates) {
        await storePut(tx, STORE_TANGLEGRAM_STATES, state);
      }
    }
  );
}
