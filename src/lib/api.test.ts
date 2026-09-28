import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  clearProjectWorkingCopy,
  createManualProjectFile,
  createProject,
  deleteProject,
  deleteProjectFile,
  getOriginalProjectFile,
  getProject,
  getProjectFile,
  getProjectFileViewState,
  getProjectTanglegramState,
  listProjects,
  optimizeProjectTanglegram,
  putProjectFileViewState,
  putProjectTanglegramState,
  reorderProjectFiles,
  saveProjectFileContent,
  updateProjectWorkingCopy,
} from './api';
import { exportBackup, importBackup, parseBackup } from './backup';
import { deleteDatabase } from './storage/db';

const TREE_A = '((A,B),(C,D));';
const TREE_B = '((C,D),(A,B));';

beforeEach(async () => {
  await deleteDatabase();
});

async function seedProjectWithTrees() {
  const project = await createProject('Демо', 'описание');
  const fileA = await createManualProjectFile(project.id, {
    name: 'left',
    format: 'newick',
    content: TREE_A,
  });
  const fileB = await createManualProjectFile(project.id, {
    name: 'right',
    format: 'newick',
    content: TREE_B,
  });
  return { project, fileA, fileB };
}

describe('проекты', () => {
  it('создаёт, перечисляет и удаляет проект', async () => {
    expect(await listProjects()).toEqual([]);

    const created = await createProject('  Проект  ', '  текст  ');
    expect(created.name).toBe('Проект');
    expect(created.description).toBe('текст');
    expect(created.fileCount).toBe(0);

    const listed = await listProjects();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);

    await deleteProject(created.id);
    expect(await listProjects()).toEqual([]);
  });

  it('пустое описание превращается в null', async () => {
    const created = await createProject('Без описания', '   ');
    expect(created.description).toBeNull();
  });

  it('несуществующий проект даёт 404', async () => {
    await expect(getProject('нет-такого')).rejects.toBeInstanceOf(ApiError);
    await expect(getProject('нет-такого')).rejects.toMatchObject({ status: 404 });
  });

  it('удаление проекта уносит файлы и состояния', async () => {
    const { project, fileA } = await seedProjectWithTrees();
    await putProjectFileViewState(project.id, fileA.id, {
      viewStateJson: { zoom: 2 },
      renderOptionsJson: {},
      selectedNodeId: null,
    });
    await deleteProject(project.id);

    const backup = await exportBackup();
    expect(backup.projects).toEqual([]);
    expect(backup.documents).toEqual([]);
    expect(backup.viewStates).toEqual([]);
  });
});

describe('файлы деревьев', () => {
  it('добавляет файл вручную и считает листья', async () => {
    const project = await createProject('Проект', '');
    const file = await createManualProjectFile(project.id, {
      name: 'дерево',
      format: 'newick',
      content: TREE_A,
    });

    expect(file.name).toBe('дерево.nwk');
    expect(file.format).toBe('newick');
    expect(file.leafCount).toBe(4);

    const detail = await getProject(project.id);
    expect(detail.files).toHaveLength(1);
    expect(detail.project.fileCount).toBe(1);
  });

  it('отвергает пустое и некорректное содержимое', async () => {
    const project = await createProject('Проект', '');

    await expect(
      createManualProjectFile(project.id, { name: 'x', format: 'newick', content: '   ' })
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      createManualProjectFile(project.id, { name: 'x', format: 'newick', content: '((A,B)' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('рабочая копия подменяет содержимое и сбрасывается обратно', async () => {
    const { project, fileA } = await seedProjectWithTrees();

    const updated = await updateProjectWorkingCopy(project.id, fileA.id, '((B,A),(D,C));');
    expect(updated.content).toBe('((B,A),(D,C));');

    expect((await getProjectFile(project.id, fileA.id)).content).toBe('((B,A),(D,C));');
    expect((await getOriginalProjectFile(project.id, fileA.id)).content).toBe(TREE_A);

    const cleared = await clearProjectWorkingCopy(project.id, fileA.id);
    expect(cleared.content).toBe(TREE_A);
    expect((await getProjectFile(project.id, fileA.id)).content).toBe(TREE_A);
  });

  it('сохранение содержимого заменяет оригинал и снимает рабочую копию', async () => {
    const { project, fileA } = await seedProjectWithTrees();
    await updateProjectWorkingCopy(project.id, fileA.id, '((B,A),(D,C));');

    const saved = await saveProjectFileContent(project.id, fileA.id, '(A,(B,(C,D)));');
    expect(saved.content).toBe('(A,(B,(C,D)));');
    expect((await getOriginalProjectFile(project.id, fileA.id)).content).toBe('(A,(B,(C,D)));');
    expect((await getProjectFile(project.id, fileA.id)).content).toBe('(A,(B,(C,D)));');
  });

  it('меняет порядок файлов и проверяет состав списка', async () => {
    const { project, fileA, fileB } = await seedProjectWithTrees();

    const reordered = await reorderProjectFiles(project.id, [fileB.id, fileA.id]);
    expect(reordered.map((file) => file.id)).toEqual([fileB.id, fileA.id]);
    expect((await getProject(project.id)).files.map((file) => file.id)).toEqual([fileB.id, fileA.id]);

    await expect(reorderProjectFiles(project.id, [fileA.id])).rejects.toMatchObject({ status: 400 });
  });

  it('удаление файла убирает и его состояние просмотра', async () => {
    const { project, fileA } = await seedProjectWithTrees();
    await putProjectFileViewState(project.id, fileA.id, {
      viewStateJson: { zoom: 3 },
      renderOptionsJson: {},
      selectedNodeId: 'node-1',
    });

    await deleteProjectFile(project.id, fileA.id);
    expect((await getProject(project.id)).files).toHaveLength(1);
    expect((await exportBackup()).viewStates).toEqual([]);
  });

  it('файл из чужого проекта не виден', async () => {
    const { fileA } = await seedProjectWithTrees();
    const other = await createProject('Другой', '');
    await expect(getProjectFile(other.id, fileA.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('состояния просмотра', () => {
  it('отдаёт пустое состояние, пока ничего не сохранено', async () => {
    const { project, fileA } = await seedProjectWithTrees();
    const state = await getProjectFileViewState(project.id, fileA.id);
    expect(state).toEqual({
      treeDocumentId: fileA.id,
      viewStateJson: {},
      renderOptionsJson: {},
      selectedNodeId: null,
    });
  });

  it('сохраняет и перечитывает состояние дерева', async () => {
    const { project, fileA } = await seedProjectWithTrees();
    await putProjectFileViewState(project.id, fileA.id, {
      viewStateJson: { collapsed: ['n1'] },
      renderOptionsJson: { showLabels: true },
      selectedNodeId: 'n1',
    });

    const state = await getProjectFileViewState(project.id, fileA.id);
    expect(state.viewStateJson).toEqual({ collapsed: ['n1'] });
    expect(state.renderOptionsJson).toEqual({ showLabels: true });
    expect(state.selectedNodeId).toBe('n1');
  });

  it('сохраняет и перечитывает состояние танглограммы', async () => {
    const { project, fileA, fileB } = await seedProjectWithTrees();
    await putProjectTanglegramState(project.id, {
      treeAId: fileA.id,
      treeBId: fileB.id,
      stateJson: { focus: 'A' },
      renderOptionsJson: { alignTipsA: true },
    });

    const state = await getProjectTanglegramState(project.id);
    expect(state.treeAId).toBe(fileA.id);
    expect(state.treeBId).toBe(fileB.id);
    expect(state.stateJson).toEqual({ focus: 'A' });
  });
});

describe('оптимизация', () => {
  it('использует сохранённую пару деревьев', async () => {
    const { project, fileA, fileB } = await seedProjectWithTrees();
    await putProjectTanglegramState(project.id, {
      treeAId: fileA.id,
      treeBId: fileB.id,
      stateJson: {},
      renderOptionsJson: {},
    });

    const result = await optimizeProjectTanglegram(project.id);
    expect(result.treeAId).toBe(fileA.id);
    expect(result.treeBId).toBe(fileB.id);
    expect(result.method).toBe('greedy_fallback');
    expect(result.finalCrossings).toBeLessThanOrEqual(result.initialCrossings);
    expect(result.finalCrossings).toBe(0);
  });

  it('требует пару деревьев', async () => {
    const { project, fileA } = await seedProjectWithTrees();
    await expect(optimizeProjectTanglegram(project.id)).rejects.toMatchObject({ status: 400 });
    await expect(
      optimizeProjectTanglegram(project.id, { treeAId: fileA.id })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      optimizeProjectTanglegram(project.id, { treeAId: fileA.id, treeBId: fileA.id })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('резервные копии', () => {
  it('переживает полный цикл выгрузки и загрузки', async () => {
    const { project, fileA, fileB } = await seedProjectWithTrees();
    await putProjectFileViewState(project.id, fileA.id, {
      viewStateJson: { zoom: 4 },
      renderOptionsJson: {},
      selectedNodeId: null,
    });
    await putProjectTanglegramState(project.id, {
      treeAId: fileA.id,
      treeBId: fileB.id,
      stateJson: { focus: 'B' },
      renderOptionsJson: {},
    });

    const payload = await exportBackup();
    const roundTripped = parseBackup(JSON.stringify(payload));

    await deleteDatabase();
    expect(await listProjects()).toEqual([]);

    await importBackup(roundTripped);

    const projects = await listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Демо');
    expect(projects[0].fileCount).toBe(2);

    expect((await getProjectFile(project.id, fileA.id)).content).toBe(TREE_A);
    expect((await getProjectFileViewState(project.id, fileA.id)).viewStateJson).toEqual({ zoom: 4 });
    expect((await getProjectTanglegramState(project.id)).stateJson).toEqual({ focus: 'B' });
  });

  it('отвергает посторонний файл', () => {
    expect(() => parseBackup('не json')).toThrow('корректным JSON');
    expect(() => parseBackup('{"format":"other"}')).toThrow('резервной копией');
  });
});
