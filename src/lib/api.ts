/**
 * Локальный API поверх IndexedDB.
 *
 * Заменяет прежний HTTP-клиент к FastAPI. Имена функций, формы DTO и тексты
 * ошибок сохранены, поэтому экраны и хуки работают без изменений. Аутентификации
 * нет: приложение рассчитано на одного человека, данные лежат в его браузере.
 */

import { ApiError } from './api-error';
import { countLeaves, detectFormat } from './tree-content';
import {
  optimizeTanglegram,
  parseNewick,
  TanglegramConstraintError,
  TanglegramInputError,
  type OptimizationOptions,
  type TanglegramOptimizeMode,
} from './tanglegram-optimizer';
import {
  runTransaction,
  storeDelete,
  storeGet,
  storeGetAll,
  storeGetAllByIndex,
  storePut,
  STORE_DOCUMENTS,
  STORE_PROJECTS,
  STORE_TANGLEGRAM_STATES,
  STORE_VIEW_STATES,
} from './storage/db';
import {
  newId,
  nowIso,
  utf8ByteLength,
  type DocumentRecord,
  type ProjectRecord,
  type TanglegramStateRecord,
  type ViewStateRecord,
} from './storage/records';

export { ApiError };
export type { TanglegramOptimizeMode };

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
}

export interface FileDto {
  id: string;
  name: string;
  format: string;
  treeCount: number;
  leafCount: number | null;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface FileContentDto extends FileDto {
  content: string;
}

export type ManualTreeFormat = 'newick' | 'nexus' | 'phyloxml';

export interface TreeViewStateDto {
  treeDocumentId: string;
  viewStateJson: Record<string, unknown>;
  renderOptionsJson: Record<string, unknown>;
  selectedNodeId: string | null;
}

export interface TanglegramStateDto {
  projectId: string;
  treeAId: string | null;
  treeBId: string | null;
  stateJson: Record<string, unknown>;
  renderOptionsJson: Record<string, unknown>;
}

export interface TanglegramOptimizeRequestDto {
  treeAId?: string;
  treeBId?: string;
  mode?: TanglegramOptimizeMode;
  maxLeaves?: number;
  maxSteps?: number;
  includeActions?: boolean;
}

export interface OptimizedTreeDto {
  newick: string;
  leafCount: number;
}

export interface TanglegramOptimizeResponseDto {
  projectId: string;
  treeAId: string;
  treeBId: string;
  requestedMode: TanglegramOptimizeMode;
  effectiveMode: 'greedy' | 'greedy_fallback';
  method: 'greedy' | 'greedy_fallback';
  nLeaves: number;
  leftLeafCount: number;
  rightLeafCount: number;
  matchedLeafCount: number;
  maxLeaves: number;
  maxSteps: number;
  initialCrossings: number;
  finalCrossings: number;
  bestCrossings: number;
  absoluteImprovement: number;
  relativeImprovement: number;
  bestRelativeImprovement: number;
  stepsUsed: number;
  runtimeSec: number;
  stopReason: string;
  warnings: string[];
  optimizedTreeA: OptimizedTreeDto;
  optimizedTreeB: OptimizedTreeDto;
  actions: number[] | null;
}

export interface ProjectDetailDto {
  project: ProjectDto;
  files: FileDto[];
}

const MANUAL_FORMAT_EXTENSIONS: Record<ManualTreeFormat, string> = {
  newick: '.nwk',
  nexus: '.nexus',
  phyloxml: '.phyloxml',
};

function notFound(message: string): ApiError {
  return new ApiError(message, 404, { message });
}

function badRequest(message: string): ApiError {
  return new ApiError(message, 400, { message });
}

function unprocessable(message: string): ApiError {
  return new ApiError(message, 422, { message });
}

function toProjectDto(project: ProjectRecord, fileCount: number): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    fileCount,
  };
}

function toFileDto(document: DocumentRecord): FileDto {
  return {
    id: document.id,
    name: document.name,
    format: document.sourceFormat,
    treeCount: document.treeCount,
    leafCount: document.leafCount,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toFileContentDto(document: DocumentRecord, content: string): FileContentDto {
  return { ...toFileDto(document), content };
}

function bySortOrder(a: DocumentRecord, b: DocumentRecord): number {
  return a.sortOrder - b.sortOrder;
}

async function requireProject(tx: IDBTransaction, projectId: string): Promise<ProjectRecord> {
  const project = await storeGet<ProjectRecord>(tx, STORE_PROJECTS, projectId);
  if (!project) {
    throw notFound('Project not found');
  }
  return project;
}

async function requireDocument(
  tx: IDBTransaction,
  projectId: string,
  fileId: string
): Promise<DocumentRecord> {
  const document = await storeGet<DocumentRecord>(tx, STORE_DOCUMENTS, fileId);
  if (!document || document.projectId !== projectId) {
    throw notFound('Tree document not found');
  }
  return document;
}

async function nextSortOrder(tx: IDBTransaction, projectId: string): Promise<number> {
  const documents = await storeGetAllByIndex<DocumentRecord>(tx, STORE_DOCUMENTS, 'projectId', projectId);
  return documents.reduce((max, document) => Math.max(max, document.sortOrder + 1), 0);
}

/* -------------------------------------------------------------------------- */
/* Проекты                                                                     */
/* -------------------------------------------------------------------------- */

export async function listProjects(): Promise<ProjectDto[]> {
  return runTransaction([STORE_PROJECTS, STORE_DOCUMENTS], 'readonly', async (tx) => {
    const projects = await storeGetAll<ProjectRecord>(tx, STORE_PROJECTS);
    const documents = await storeGetAll<DocumentRecord>(tx, STORE_DOCUMENTS);

    const counts = new Map<string, number>();
    for (const document of documents) {
      counts.set(document.projectId, (counts.get(document.projectId) ?? 0) + 1);
    }

    return projects
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((project) => toProjectDto(project, counts.get(project.id) ?? 0));
  });
}

export async function createProject(name: string, description: string): Promise<ProjectDto> {
  const timestamp = nowIso();
  const project: ProjectRecord = {
    id: newId(),
    name: name.trim(),
    description: description.trim() || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await runTransaction(STORE_PROJECTS, 'readwrite', (tx) => storePut(tx, STORE_PROJECTS, project));
  return toProjectDto(project, 0);
}

export async function deleteProject(projectId: string): Promise<void> {
  await runTransaction(
    [STORE_PROJECTS, STORE_DOCUMENTS, STORE_VIEW_STATES, STORE_TANGLEGRAM_STATES],
    'readwrite',
    async (tx) => {
      await requireProject(tx, projectId);
      const documents = await storeGetAllByIndex<DocumentRecord>(tx, STORE_DOCUMENTS, 'projectId', projectId);

      // Каскад, который в PostgreSQL обеспечивал ON DELETE CASCADE.
      for (const document of documents) {
        await storeDelete(tx, STORE_VIEW_STATES, document.id);
        await storeDelete(tx, STORE_DOCUMENTS, document.id);
      }
      await storeDelete(tx, STORE_TANGLEGRAM_STATES, projectId);
      await storeDelete(tx, STORE_PROJECTS, projectId);
    }
  );
}

export async function getProject(projectId: string): Promise<ProjectDetailDto> {
  return runTransaction([STORE_PROJECTS, STORE_DOCUMENTS], 'readonly', async (tx) => {
    const project = await requireProject(tx, projectId);
    const documents = await storeGetAllByIndex<DocumentRecord>(tx, STORE_DOCUMENTS, 'projectId', projectId);
    const ordered = documents.slice().sort(bySortOrder);
    return {
      project: toProjectDto(project, ordered.length),
      files: ordered.map(toFileDto),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Файлы деревьев                                                              */
/* -------------------------------------------------------------------------- */

export async function uploadProjectFile(projectId: string, file: File): Promise<FileDto> {
  if (file.size === 0) {
    throw badRequest('Uploaded file is empty');
  }

  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw badRequest('Only UTF-8 encoded text files are supported');
  }

  const name = file.name || 'untitled.newick';
  const detectedFormat = detectFormat(name, content);
  const timestamp = nowIso();

  return runTransaction([STORE_PROJECTS, STORE_DOCUMENTS], 'readwrite', async (tx) => {
    await requireProject(tx, projectId);
    const document: DocumentRecord = {
      id: newId(),
      projectId,
      name,
      sourceType: 'file',
      sourceFormat: detectedFormat,
      originalContent: content,
      workingNewick: null,
      treeCount: 1,
      leafCount: countLeaves(content, detectedFormat),
      sizeBytes: file.size,
      sortOrder: await nextSortOrder(tx, projectId),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await storePut(tx, STORE_DOCUMENTS, document);
    return toFileDto(document);
  });
}

export async function createManualProjectFile(
  projectId: string,
  payload: { name: string; format: ManualTreeFormat; content: string }
): Promise<FileDto> {
  const content = payload.content.trim();
  if (!content) {
    throw badRequest('Tree content is required');
  }

  let name = payload.name.trim() || 'untitled';
  const expectedExtension = MANUAL_FORMAT_EXTENSIONS[payload.format];
  if (!name.toLowerCase().endsWith(expectedExtension)) {
    name = `${name}${expectedExtension}`;
  }

  const detectedFormat = detectFormat(name, content);
  if (payload.format === 'newick') {
    try {
      parseNewick(content);
    } catch (error) {
      throw badRequest(error instanceof Error ? error.message : 'Invalid Newick tree');
    }
  }

  const timestamp = nowIso();

  return runTransaction([STORE_PROJECTS, STORE_DOCUMENTS], 'readwrite', async (tx) => {
    await requireProject(tx, projectId);
    const document: DocumentRecord = {
      id: newId(),
      projectId,
      name,
      sourceType: 'manual',
      sourceFormat: detectedFormat,
      originalContent: content,
      workingNewick: null,
      treeCount: 1,
      leafCount: countLeaves(content, detectedFormat),
      sizeBytes: utf8ByteLength(content),
      sortOrder: await nextSortOrder(tx, projectId),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await storePut(tx, STORE_DOCUMENTS, document);
    return toFileDto(document);
  });
}

export async function getProjectFile(projectId: string, fileId: string): Promise<FileContentDto> {
  return runTransaction(STORE_DOCUMENTS, 'readonly', async (tx) => {
    const document = await requireDocument(tx, projectId, fileId);
    return toFileContentDto(document, document.workingNewick ?? document.originalContent);
  });
}

export async function getOriginalProjectFile(projectId: string, fileId: string): Promise<FileContentDto> {
  return runTransaction(STORE_DOCUMENTS, 'readonly', async (tx) => {
    const document = await requireDocument(tx, projectId, fileId);
    return toFileContentDto(document, document.originalContent);
  });
}

export async function updateProjectWorkingCopy(
  projectId: string,
  fileId: string,
  rawContent: string
): Promise<FileContentDto> {
  const content = rawContent.trim();
  if (!content) {
    throw badRequest('Tree content is required');
  }

  return runTransaction(STORE_DOCUMENTS, 'readwrite', async (tx) => {
    const document = await requireDocument(tx, projectId, fileId);
    if (document.workingNewick === content) {
      return toFileContentDto(document, content);
    }

    const sourceFormat = detectFormat(document.name, content);
    const updated: DocumentRecord = {
      ...document,
      workingNewick: content,
      sourceFormat,
      leafCount: countLeaves(content, sourceFormat),
      sizeBytes: utf8ByteLength(content),
      updatedAt: nowIso(),
    };
    await storePut(tx, STORE_DOCUMENTS, updated);
    return toFileContentDto(updated, content);
  });
}

export async function clearProjectWorkingCopy(projectId: string, fileId: string): Promise<FileContentDto> {
  return runTransaction(STORE_DOCUMENTS, 'readwrite', async (tx) => {
    const document = await requireDocument(tx, projectId, fileId);
    if (document.workingNewick === null) {
      return toFileContentDto(document, document.originalContent);
    }

    const sourceFormat = detectFormat(document.name, document.originalContent);
    const updated: DocumentRecord = {
      ...document,
      workingNewick: null,
      sourceFormat,
      leafCount: countLeaves(document.originalContent, sourceFormat),
      sizeBytes: utf8ByteLength(document.originalContent),
      updatedAt: nowIso(),
    };
    await storePut(tx, STORE_DOCUMENTS, updated);
    return toFileContentDto(updated, updated.originalContent);
  });
}

export async function saveProjectFileContent(
  projectId: string,
  fileId: string,
  rawContent: string
): Promise<FileContentDto> {
  const content = rawContent.trim();
  if (!content) {
    throw badRequest('Tree content is required');
  }

  return runTransaction(STORE_DOCUMENTS, 'readwrite', async (tx) => {
    const document = await requireDocument(tx, projectId, fileId);
    if (document.originalContent === content && document.workingNewick === null) {
      return toFileContentDto(document, document.originalContent);
    }

    const sourceFormat = detectFormat(document.name, content);
    const updated: DocumentRecord = {
      ...document,
      originalContent: content,
      workingNewick: null,
      sourceFormat,
      leafCount: countLeaves(content, sourceFormat),
      sizeBytes: utf8ByteLength(content),
      updatedAt: nowIso(),
    };
    await storePut(tx, STORE_DOCUMENTS, updated);
    return toFileContentDto(updated, updated.originalContent);
  });
}

export async function deleteProjectFile(projectId: string, fileId: string): Promise<void> {
  await runTransaction([STORE_DOCUMENTS, STORE_VIEW_STATES], 'readwrite', async (tx) => {
    await requireDocument(tx, projectId, fileId);
    await storeDelete(tx, STORE_VIEW_STATES, fileId);
    await storeDelete(tx, STORE_DOCUMENTS, fileId);
  });
}

export async function reorderProjectFiles(projectId: string, fileIds: string[]): Promise<FileDto[]> {
  return runTransaction([STORE_PROJECTS, STORE_DOCUMENTS], 'readwrite', async (tx) => {
    await requireProject(tx, projectId);
    const documents = await storeGetAllByIndex<DocumentRecord>(tx, STORE_DOCUMENTS, 'projectId', projectId);

    const currentIds = documents.map((document) => document.id).sort();
    const requestedIds = fileIds.slice().sort();
    const sameSet =
      currentIds.length === requestedIds.length &&
      currentIds.every((id, index) => id === requestedIds[index]);
    if (!sameSet) {
      throw badRequest('fileIds must match project files exactly');
    }

    const byId = new Map(documents.map((document) => [document.id, document]));
    const timestamp = nowIso();
    const reordered: DocumentRecord[] = [];

    for (const [index, fileId] of fileIds.entries()) {
      const updated: DocumentRecord = { ...byId.get(fileId)!, sortOrder: index, updatedAt: timestamp };
      await storePut(tx, STORE_DOCUMENTS, updated);
      reordered.push(updated);
    }

    return reordered.map(toFileDto);
  });
}

/* -------------------------------------------------------------------------- */
/* Состояние просмотра                                                         */
/* -------------------------------------------------------------------------- */

export async function getProjectFileViewState(
  projectId: string,
  fileId: string
): Promise<TreeViewStateDto> {
  return runTransaction([STORE_DOCUMENTS, STORE_VIEW_STATES], 'readonly', async (tx) => {
    const document = await requireDocument(tx, projectId, fileId);
    const state = await storeGet<ViewStateRecord>(tx, STORE_VIEW_STATES, document.id);
    return {
      treeDocumentId: document.id,
      viewStateJson: state?.viewStateJson ?? {},
      renderOptionsJson: state?.renderOptionsJson ?? {},
      selectedNodeId: state?.selectedNodeId ?? null,
    };
  });
}

export async function putProjectFileViewState(
  projectId: string,
  fileId: string,
  payload: {
    viewStateJson: Record<string, unknown>;
    renderOptionsJson: Record<string, unknown>;
    selectedNodeId: string | null;
  }
): Promise<TreeViewStateDto> {
  return runTransaction([STORE_DOCUMENTS, STORE_VIEW_STATES], 'readwrite', async (tx) => {
    const document = await requireDocument(tx, projectId, fileId);
    const record: ViewStateRecord = {
      treeDocumentId: document.id,
      projectId,
      viewStateJson: payload.viewStateJson,
      renderOptionsJson: payload.renderOptionsJson,
      selectedNodeId: payload.selectedNodeId,
      updatedAt: nowIso(),
    };
    await storePut(tx, STORE_VIEW_STATES, record);
    return {
      treeDocumentId: record.treeDocumentId,
      viewStateJson: record.viewStateJson,
      renderOptionsJson: record.renderOptionsJson,
      selectedNodeId: record.selectedNodeId,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Состояние танглограммы                                                      */
/* -------------------------------------------------------------------------- */

export async function getProjectTanglegramState(projectId: string): Promise<TanglegramStateDto> {
  return runTransaction([STORE_PROJECTS, STORE_TANGLEGRAM_STATES], 'readonly', async (tx) => {
    await requireProject(tx, projectId);
    const state = await storeGet<TanglegramStateRecord>(tx, STORE_TANGLEGRAM_STATES, projectId);
    return {
      projectId,
      treeAId: state?.treeAId ?? null,
      treeBId: state?.treeBId ?? null,
      stateJson: state?.stateJson ?? {},
      renderOptionsJson: state?.renderOptionsJson ?? {},
    };
  });
}

export async function putProjectTanglegramState(
  projectId: string,
  payload: {
    treeAId: string | null;
    treeBId: string | null;
    stateJson: Record<string, unknown>;
    renderOptionsJson: Record<string, unknown>;
  }
): Promise<TanglegramStateDto> {
  return runTransaction([STORE_PROJECTS, STORE_TANGLEGRAM_STATES], 'readwrite', async (tx) => {
    await requireProject(tx, projectId);
    const record: TanglegramStateRecord = {
      projectId,
      treeAId: payload.treeAId,
      treeBId: payload.treeBId,
      stateJson: payload.stateJson,
      renderOptionsJson: payload.renderOptionsJson,
      updatedAt: nowIso(),
    };
    await storePut(tx, STORE_TANGLEGRAM_STATES, record);
    return {
      projectId,
      treeAId: record.treeAId,
      treeBId: record.treeBId,
      stateJson: record.stateJson,
      renderOptionsJson: record.renderOptionsJson,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Оптимизация                                                                 */
/* -------------------------------------------------------------------------- */

export async function optimizeProjectTanglegram(
  projectId: string,
  payload: TanglegramOptimizeRequestDto = {}
): Promise<TanglegramOptimizeResponseDto> {
  const { documentA, documentB } = await runTransaction(
    [STORE_PROJECTS, STORE_DOCUMENTS, STORE_TANGLEGRAM_STATES],
    'readonly',
    async (tx) => {
      await requireProject(tx, projectId);

      const treeAProvided = payload.treeAId !== undefined && payload.treeAId !== null;
      const treeBProvided = payload.treeBId !== undefined && payload.treeBId !== null;
      if (treeAProvided !== treeBProvided) {
        throw badRequest('treeAId and treeBId must be provided together');
      }

      let treeAId = payload.treeAId ?? null;
      let treeBId = payload.treeBId ?? null;
      if (treeAId === null) {
        const saved = await storeGet<TanglegramStateRecord>(tx, STORE_TANGLEGRAM_STATES, projectId);
        treeAId = saved?.treeAId ?? null;
        treeBId = saved?.treeBId ?? null;
      }
      if (treeAId === null || treeBId === null) {
        throw badRequest('Select two trees before optimization');
      }
      if (treeAId === treeBId) {
        throw badRequest('Tanglegram optimization requires two different tree documents');
      }

      return {
        documentA: await requireDocument(tx, projectId, treeAId),
        documentB: await requireDocument(tx, projectId, treeBId),
      };
    }
  );

  const contentA = documentA.workingNewick ?? documentA.originalContent;
  const contentB = documentB.workingNewick ?? documentB.originalContent;

  // Ключи с undefined не передаём: они бы затёрли значения по умолчанию при слиянии.
  const overrides: Partial<OptimizationOptions> = {
    mode: payload.mode ?? 'auto',
    maxSteps: payload.maxSteps ?? null,
    includeActions: payload.includeActions ?? false,
  };
  if (payload.maxLeaves !== undefined) {
    overrides.maxLeaves = payload.maxLeaves;
  }

  try {
    const result = optimizeTanglegram(contentA, contentB, overrides);
    return { ...result, projectId, treeAId: documentA.id, treeBId: documentB.id };
  } catch (error) {
    if (error instanceof TanglegramInputError) {
      throw badRequest(error.message);
    }
    if (error instanceof TanglegramConstraintError) {
      throw unprocessable(error.message);
    }
    throw error;
  }
}
