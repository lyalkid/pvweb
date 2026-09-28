import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { RouteState } from '../app/routes';
import type { AppModel } from './useAppModel';
import { useI18n } from '../i18n/provider';
import {
  clearProjectWorkingCopy,
  getOriginalProjectFile,
  getProjectFile,
  getProjectFileViewState,
  putProjectFileViewState,
  saveProjectFileContent,
  updateProjectWorkingCopy,
  type FileDto,
  type ProjectDetailDto,
} from '../lib/api';
import { getErrorMessage } from '../utils/errors';
import { isViewerSupportedFormat } from '../utils/formats';
import {
  buildSingleViewStateSignature,
  emptyViewStateSnapshot,
  mergeTreeRenderOptions,
  normalizeViewStateSnapshot,
} from '../utils/viewer-persistence';
import { buildViewerDocumentFromContent, type ViewerDocument } from '../utils/viewer-document';
import { HistoryManager, PhyloTreeModel, ViewState, parseAuto, type ViewStateSnapshot } from 'phylo-tree-lib';

const LAST_OPENED_TREE_FILE_KEY_PREFIX = 'phylo-viewer-last-opened-tree-file';

interface SingleTreeHistoryEntry {
  workingText: string;
  viewStateSnapshot: ViewStateSnapshot;
  selectedNodeId: string | null;
}

interface UseSingleTreeDocumentParams {
  route: RouteState;
  navigate: (next: RouteState, replace?: boolean) => void;
  model: AppModel;
  selectedProject: ProjectDetailDto | null;
  setWorkspaceBusy: (busy: boolean) => void;
  setWorkspaceError: Dispatch<SetStateAction<string | null>>;
  onProjectFileUpdated: (file: FileDto) => void;
}

interface UseSingleTreeDocumentResult {
  activeTreeFileId: string | null;
  singleDocument: ViewerDocument | null;
  singleViewStateSnapshot: ViewStateSnapshot | null;
  singleSelectedNodeId: string | null;
  singleSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  editorText: string;
  originalText: string;
  contentSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  editorParseError: string | null;
  singleActionMessage: string | null;
  canUndoSingleHistory: boolean;
  canRedoSingleHistory: boolean;
  setSingleSelectedNodeId: (nodeId: string | null) => void;
  setEditorText: (text: string) => void;
  handleOpenTree: (file: FileDto) => Promise<void>;
  handleToggleCollapseSelected: () => void;
  handleSetSelectedColor: (color: string) => void;
  handleClearSelectedColor: () => void;
  handleExpandAllSingle: () => void;
  handleRerootSelected: () => Promise<void>;
  handleSwapSelectedChildren: () => Promise<void>;
  handlePruneSelected: () => Promise<void>;
  handleLadderizeSingle: (direction: 'ascending' | 'descending') => Promise<void>;
  handleUndoSingleHistory: () => Promise<void>;
  handleRedoSingleHistory: () => Promise<void>;
  handleRenderEditorText: () => Promise<void>;
  handleSaveEditorText: () => Promise<void>;
  handleRestoreOriginalText: () => Promise<void>;
  clearIfDeleted: (fileId: string) => void;
  resetSingleTreeState: () => void;
}

export function useSingleTreeDocument({
  route,
  navigate,
  model,
  selectedProject,
  setWorkspaceBusy,
  setWorkspaceError,
  onProjectFileUpdated,
}: UseSingleTreeDocumentParams): UseSingleTreeDocumentResult {
  const { t } = useI18n();
  const [activeTreeFileId, setActiveTreeFileId] = useState<string | null>(null);
  const [singleDocument, setSingleDocument] = useState<ViewerDocument | null>(null);
  const [singleViewStateSnapshot, setSingleViewStateSnapshot] = useState<ViewStateSnapshot | null>(null);
  const [singleSelectedNodeId, setSingleSelectedNodeId] = useState<string | null>(null);
  const [singleSaveStatus, setSingleSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [editorText, setEditorText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [contentSaveStatus, setContentSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [singleActionMessage, setSingleActionMessage] = useState<string | null>(null);
  const [canUndoSingleHistory, setCanUndoSingleHistory] = useState(false);
  const [canRedoSingleHistory, setCanRedoSingleHistory] = useState(false);
  const lastSinglePersistedSignatureRef = useRef<string | null>(null);
  const lastRestoreAttemptKeyRef = useRef<string | null>(null);
  const singleHistoryRef = useRef<HistoryManager<SingleTreeHistoryEntry> | null>(null);
  const editorParseError = useMemo(() => {
    if (!singleDocument || !editorText.trim()) {
      return null;
    }
    try {
      const parsed = parseAuto(editorText.trim());
      if (!parsed.tree) {
        return t('singleTree.errorTreeExtract');
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : t('formats.parseTreeError');
    }
  }, [editorText, singleDocument]);

  const buildHistoryEntry = useCallback((
    workingText: string,
    viewStateSnapshot: ViewStateSnapshot | null,
    selectedNodeId: string | null
  ): SingleTreeHistoryEntry => ({
    workingText,
    viewStateSnapshot: viewStateSnapshot ?? emptyViewStateSnapshot(),
    selectedNodeId,
  }), []);

  const updateHistoryFlags = useCallback(() => {
    setCanUndoSingleHistory(singleHistoryRef.current?.canUndo() ?? false);
    setCanRedoSingleHistory(singleHistoryRef.current?.canRedo() ?? false);
  }, []);

  const resetSingleHistory = useCallback((
    workingText: string,
    viewStateSnapshot: ViewStateSnapshot | null,
    selectedNodeId: string | null
  ) => {
    const entry = buildHistoryEntry(workingText, viewStateSnapshot, selectedNodeId);
    if (!singleHistoryRef.current) {
      singleHistoryRef.current = new HistoryManager(entry);
    } else {
      singleHistoryRef.current.reset(entry);
    }
    updateHistoryFlags();
  }, [buildHistoryEntry, updateHistoryFlags]);

  const pushSingleHistory = useCallback((
    workingText: string,
    viewStateSnapshot: ViewStateSnapshot | null,
    selectedNodeId: string | null
  ) => {
    if (!singleHistoryRef.current) {
      singleHistoryRef.current = new HistoryManager(buildHistoryEntry(workingText, viewStateSnapshot, selectedNodeId));
      updateHistoryFlags();
      return;
    }
    singleHistoryRef.current.push(buildHistoryEntry(workingText, viewStateSnapshot, selectedNodeId));
    updateHistoryFlags();
  }, [buildHistoryEntry, updateHistoryFlags]);

  const resetSingleTreeState = useCallback(() => {
    setActiveTreeFileId(null);
    setSingleDocument(null);
    setSingleViewStateSnapshot(null);
    setSingleSelectedNodeId(null);
    setSingleSaveStatus('idle');
    setEditorText('');
    setOriginalText('');
    setContentSaveStatus('idle');
    setSingleActionMessage(null);
    singleHistoryRef.current = null;
    setCanUndoSingleHistory(false);
    setCanRedoSingleHistory(false);
    lastSinglePersistedSignatureRef.current = null;
  }, []);

  const applySingleDocumentResult = useCallback((
    nextFileContent: Awaited<ReturnType<typeof getProjectFile>>,
    nextSnapshot: ViewStateSnapshot | null,
    nextSelectedNodeId: string | null,
    historyMode: 'none' | 'push' | 'reset'
  ) => {
    const nextDocument = buildViewerDocumentFromContent(nextFileContent);
    setSingleDocument(nextDocument);
    onProjectFileUpdated(nextFileContent);
    setEditorText(nextFileContent.content);
    setSingleViewStateSnapshot(nextSnapshot);
    setSingleSelectedNodeId(nextSelectedNodeId);
    if (historyMode === 'reset') {
      resetSingleHistory(nextFileContent.content, nextSnapshot, nextSelectedNodeId);
    } else if (historyMode === 'push') {
      pushSingleHistory(nextFileContent.content, nextSnapshot, nextSelectedNodeId);
    }
  }, [onProjectFileUpdated, pushSingleHistory, resetSingleHistory]);

  const handleOpenTree = useCallback(async (file: FileDto) => {
    if (!selectedProject) {
      return;
    }
    if (!isViewerSupportedFormat(file.format)) {
      setWorkspaceError(t('formats.viewerSupportMessage'));
      return;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    try {
      const [fileContent, originalFileContent, viewState] = await Promise.all([
        getProjectFile(selectedProject.project.id, file.id),
        getOriginalProjectFile(selectedProject.project.id, file.id),
        getProjectFileViewState(selectedProject.project.id, file.id),
      ]);
      const normalizedSnapshot = normalizeViewStateSnapshot(viewState.viewStateJson);
      const mergedOptions = mergeTreeRenderOptions(viewState.renderOptionsJson);
      model.actions.setMode('tree');
      applySingleDocumentResult(fileContent, normalizedSnapshot, viewState.selectedNodeId, 'reset');
      setOriginalText(originalFileContent.content);
      model.settings.replaceTree(mergedOptions);
      lastSinglePersistedSignatureRef.current = buildSingleViewStateSignature(
        normalizedSnapshot,
        mergedOptions,
        viewState.selectedNodeId
      );
      setSingleSaveStatus('idle');
      setContentSaveStatus('idle');
      setSingleActionMessage(t('singleTree.actionOpened', { name: fileContent.name }));
      setActiveTreeFileId(file.id);
      if (route.kind !== 'workspace') {
        navigate({ kind: 'workspace', projectId: selectedProject.project.id });
      }
    } catch (error) {
      setWorkspaceError(getErrorMessage(error, t('singleTree.errorOpen')));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [applySingleDocumentResult, model.actions, model.settings, navigate, route.kind, selectedProject, setWorkspaceBusy, setWorkspaceError]);

  const handleToggleCollapseSelected = useCallback(() => {
    if (!singleSelectedNodeId || !singleDocument) {
      return;
    }
    const nextSnapshot = (() => {
      const next = ViewState.fromJSON(singleViewStateSnapshot ?? emptyViewStateSnapshot());
      return next.isCollapsed(singleSelectedNodeId)
        ? next.expand(singleSelectedNodeId).toJSON()
        : next.collapse(singleSelectedNodeId).toJSON();
    })();
    setSingleViewStateSnapshot(nextSnapshot);
    pushSingleHistory(singleDocument.rawText, nextSnapshot, singleSelectedNodeId);
    setSingleActionMessage(isCollapsedLabel(nextSnapshot, singleSelectedNodeId) ? t('singleTree.actionCollapsed', { nodeId: singleSelectedNodeId }) : t('singleTree.actionExpanded', { nodeId: singleSelectedNodeId }));
  }, [pushSingleHistory, singleDocument, singleSelectedNodeId, singleViewStateSnapshot]);

  const handleSetSelectedColor = useCallback((color: string) => {
    if (!singleSelectedNodeId || !singleDocument) {
      return;
    }
    const nextSnapshot = ViewState.fromJSON(singleViewStateSnapshot ?? emptyViewStateSnapshot())
      .setColor(singleSelectedNodeId, color)
      .toJSON();
    setSingleViewStateSnapshot(nextSnapshot);
    pushSingleHistory(singleDocument.rawText, nextSnapshot, singleSelectedNodeId);
    setSingleActionMessage(t('singleTree.actionColorSet', { color, nodeId: singleSelectedNodeId }));
  }, [pushSingleHistory, singleDocument, singleSelectedNodeId, singleViewStateSnapshot]);

  const handleClearSelectedColor = useCallback(() => {
    if (!singleSelectedNodeId || !singleDocument) {
      return;
    }
    const nextSnapshot = ViewState.fromJSON(singleViewStateSnapshot ?? emptyViewStateSnapshot())
      .clearColor(singleSelectedNodeId)
      .toJSON();
    setSingleViewStateSnapshot(nextSnapshot);
    pushSingleHistory(singleDocument.rawText, nextSnapshot, singleSelectedNodeId);
    setSingleActionMessage(t('singleTree.actionColorCleared', { nodeId: singleSelectedNodeId }));
  }, [pushSingleHistory, singleDocument, singleSelectedNodeId, singleViewStateSnapshot]);

  const handleExpandAllSingle = useCallback(() => {
    if (!singleDocument) {
      return;
    }
    const nextSnapshot = ViewState.fromJSON(singleViewStateSnapshot ?? emptyViewStateSnapshot()).expandAll().toJSON();
    setSingleViewStateSnapshot(nextSnapshot);
    pushSingleHistory(singleDocument.rawText, nextSnapshot, singleSelectedNodeId);
    setSingleActionMessage(t('singleTree.actionExpandedAll'));
  }, [pushSingleHistory, singleDocument, singleSelectedNodeId, singleViewStateSnapshot]);

  const persistMutatedTree = useCallback(async (
    nextWorkingText: string,
    nextSelectedNodeId: string | null
  ) => {
    if (!selectedProject || !activeTreeFileId) {
      return;
    }
    const updated = await updateProjectWorkingCopy(
      selectedProject.project.id,
      activeTreeFileId,
      nextWorkingText
    );
    applySingleDocumentResult(updated, singleViewStateSnapshot, nextSelectedNodeId, 'push');
    setContentSaveStatus('saved');
  }, [activeTreeFileId, applySingleDocumentResult, selectedProject, singleViewStateSnapshot]);

  const handleMutateSelectedTree = useCallback(async (
    mutation: (model: PhyloTreeModel, selectedNodeId: string) => string,
    successMessage: (selectedNodeId: string) => string,
    errorMessage: string
  ) => {
    if (!singleSelectedNodeId || !singleDocument?.tree) {
      return;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    setContentSaveStatus('saving');
    try {
      const modelInstance = new PhyloTreeModel(singleDocument.tree);
      const nextWorkingText = mutation(modelInstance, singleSelectedNodeId);
      await persistMutatedTree(nextWorkingText, singleSelectedNodeId);
      setSingleActionMessage(successMessage(singleSelectedNodeId));
    } catch (error) {
      setContentSaveStatus('error');
      setWorkspaceError(getErrorMessage(error, errorMessage));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [persistMutatedTree, setWorkspaceBusy, setWorkspaceError, singleDocument?.tree, singleSelectedNodeId]);

  const handleRerootSelected = useCallback(async () => {
    await handleMutateSelectedTree(
      (modelInstance, selectedNodeId) => new PhyloTreeModel(modelInstance.reroot(selectedNodeId)).toNewick(),
      (selectedNodeId) => `Rerooted by node ${selectedNodeId}`,
      t('singleTree.errorReroot')
    );
  }, [handleMutateSelectedTree]);

  const handleSwapSelectedChildren = useCallback(async () => {
    await handleMutateSelectedTree(
      (modelInstance, selectedNodeId) => new PhyloTreeModel(modelInstance.swapChildren(selectedNodeId)).toNewick(),
      (selectedNodeId) => `Swapped children of ${selectedNodeId}`,
      t('singleTree.errorSwap')
    );
  }, [handleMutateSelectedTree]);

  const handlePruneSelected = useCallback(async () => {
    await handleMutateSelectedTree(
      (modelInstance, selectedNodeId) => new PhyloTreeModel(modelInstance.prune([selectedNodeId])).toNewick(),
      (selectedNodeId) => `Pruned subtree ${selectedNodeId}`,
      t('singleTree.errorPrune')
    );
  }, [handleMutateSelectedTree]);

  const handleLadderizeSingle = useCallback(async (direction: 'ascending' | 'descending') => {
    if (!singleDocument?.tree) {
      return;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    setContentSaveStatus('saving');
    try {
      const nextWorkingText = new PhyloTreeModel(singleDocument.tree).ladderize(direction);
      await persistMutatedTree(new PhyloTreeModel(nextWorkingText).toNewick(), singleSelectedNodeId);
      setSingleActionMessage(t(direction === 'ascending' ? 'singleTree.actionLadderizedAsc' : 'singleTree.actionLadderizedDesc'));
    } catch (error) {
      setContentSaveStatus('error');
      setWorkspaceError(getErrorMessage(error, t('singleTree.errorLadderize')));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [persistMutatedTree, setWorkspaceBusy, setWorkspaceError, singleDocument?.tree, singleSelectedNodeId]);

  const restoreSingleHistoryEntry = useCallback(async (entry: SingleTreeHistoryEntry) => {
    if (!selectedProject || !activeTreeFileId) {
      return;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    setContentSaveStatus('saving');
    try {
      const updated = await updateProjectWorkingCopy(
        selectedProject.project.id,
        activeTreeFileId,
        entry.workingText
      );
      setSingleDocument(buildViewerDocumentFromContent(updated));
      onProjectFileUpdated(updated);
      setEditorText(updated.content);
      setSingleViewStateSnapshot(entry.viewStateSnapshot);
      setSingleSelectedNodeId(entry.selectedNodeId);
      setContentSaveStatus('saved');
      setSingleActionMessage(t('singleTree.actionHistoryRestored', { name: updated.name }));
      updateHistoryFlags();
    } catch (error) {
      setContentSaveStatus('error');
      setWorkspaceError(getErrorMessage(error, t('singleTree.errorHistoryRestore')));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [activeTreeFileId, onProjectFileUpdated, selectedProject, setWorkspaceBusy, setWorkspaceError, updateHistoryFlags]);

  const handleUndoSingleHistory = useCallback(async () => {
    const entry = singleHistoryRef.current?.undo();
    if (!entry) {
      return;
    }
    await restoreSingleHistoryEntry(entry);
  }, [restoreSingleHistoryEntry]);

  const handleRedoSingleHistory = useCallback(async () => {
    const entry = singleHistoryRef.current?.redo();
    if (!entry) {
      return;
    }
    await restoreSingleHistoryEntry(entry);
  }, [restoreSingleHistoryEntry]);

  const handleRenderEditorText = useCallback(async () => {
    if (!selectedProject || !activeTreeFileId || !singleDocument) {
      return;
    }
    if (editorParseError) {
      setContentSaveStatus('error');
      setWorkspaceError(editorParseError);
      return;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    setContentSaveStatus('saving');
    try {
      const updated = await updateProjectWorkingCopy(
        selectedProject.project.id,
        activeTreeFileId,
        editorText
      );
      applySingleDocumentResult(updated, singleViewStateSnapshot, singleSelectedNodeId, 'push');
      setContentSaveStatus('saved');
      setSingleActionMessage(t('singleTree.actionRendered', { name: updated.name }));
    } catch (error) {
      setContentSaveStatus('error');
      setWorkspaceError(getErrorMessage(error, t('singleTree.errorRenderWorkingCopy')));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [activeTreeFileId, applySingleDocumentResult, editorParseError, editorText, selectedProject, setWorkspaceBusy, setWorkspaceError, singleDocument, singleSelectedNodeId, singleViewStateSnapshot]);

  const handleSaveEditorText = useCallback(async () => {
    if (!selectedProject || !activeTreeFileId || !singleDocument) {
      return;
    }
    if (editorParseError) {
      setContentSaveStatus('error');
      setWorkspaceError(editorParseError);
      return;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    setContentSaveStatus('saving');
    try {
      const saved = await saveProjectFileContent(
        selectedProject.project.id,
        activeTreeFileId,
        editorText
      );
      applySingleDocumentResult(saved, singleViewStateSnapshot, singleSelectedNodeId, 'reset');
      setOriginalText(saved.content);
      setContentSaveStatus('saved');
      setSingleActionMessage(t('singleTree.actionSaved', { name: saved.name }));
    } catch (error) {
      setContentSaveStatus('error');
      setWorkspaceError(getErrorMessage(error, t('singleTree.errorSaveFile')));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [activeTreeFileId, applySingleDocumentResult, editorParseError, editorText, selectedProject, setWorkspaceBusy, setWorkspaceError, singleDocument, singleSelectedNodeId, singleViewStateSnapshot]);

  const handleRestoreOriginalText = useCallback(async () => {
    if (!selectedProject || !activeTreeFileId || !singleDocument) {
      return;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    setContentSaveStatus('saving');
    try {
      const restored = await clearProjectWorkingCopy(
        selectedProject.project.id,
        activeTreeFileId
      );
      applySingleDocumentResult(restored, singleViewStateSnapshot, singleSelectedNodeId, 'reset');
      setOriginalText(restored.content);
      setContentSaveStatus('saved');
      setSingleActionMessage(t('singleTree.actionOriginalRestored', { name: restored.name }));
    } catch (error) {
      setContentSaveStatus('error');
      setWorkspaceError(getErrorMessage(error, t('singleTree.errorRestoreOriginal')));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [activeTreeFileId, applySingleDocumentResult, selectedProject, setWorkspaceBusy, setWorkspaceError, singleDocument, singleSelectedNodeId, singleViewStateSnapshot]);

  const clearIfDeleted = useCallback((fileId: string) => {
    if (activeTreeFileId === fileId) {
      resetSingleTreeState();
    }
  }, [activeTreeFileId, resetSingleTreeState]);

  useEffect(() => {
    if (!selectedProject?.project.id || !activeTreeFileId) {
      return;
    }
    localStorage.setItem(
      buildLastOpenedTreeFileStorageKey(selectedProject.project.id),
      activeTreeFileId
    );
    lastRestoreAttemptKeyRef.current = `${selectedProject.project.id}:${activeTreeFileId}`;
  }, [activeTreeFileId, selectedProject?.project.id]);

  useEffect(() => {
    if (route.kind !== 'workspace' || !selectedProject || activeTreeFileId) {
      return;
    }

    const storageKey = buildLastOpenedTreeFileStorageKey(selectedProject.project.id);
    const storedFileId = localStorage.getItem(storageKey);
    if (!storedFileId) {
      return;
    }

    const attemptKey = `${selectedProject.project.id}:${storedFileId}`;
    if (lastRestoreAttemptKeyRef.current === attemptKey) {
      return;
    }

    const storedFile = selectedProject.files.find((file) => file.id === storedFileId) ?? null;
    if (!storedFile || !isViewerSupportedFormat(storedFile.format)) {
      localStorage.removeItem(storageKey);
      lastRestoreAttemptKeyRef.current = attemptKey;
      return;
    }

    lastRestoreAttemptKeyRef.current = attemptKey;
    void handleOpenTree(storedFile);
  }, [activeTreeFileId, handleOpenTree, route.kind, selectedProject]);

  useEffect(() => {
    if (route.kind !== 'workspace' || !selectedProject || !activeTreeFileId || !singleDocument?.tree) {
      return;
    }

    const viewStateSnapshot = singleViewStateSnapshot ?? emptyViewStateSnapshot();
    const signature = buildSingleViewStateSignature(viewStateSnapshot, model.settings.tree, singleSelectedNodeId);

    if (lastSinglePersistedSignatureRef.current === signature) {
      return;
    }

    setSingleSaveStatus('saving');
    const timeoutId = window.setTimeout(() => {
      void putProjectFileViewState(selectedProject.project.id, activeTreeFileId, {
        viewStateJson: viewStateSnapshot as unknown as Record<string, unknown>,
        renderOptionsJson: model.settings.tree as unknown as Record<string, unknown>,
        selectedNodeId: singleSelectedNodeId,
      })
        .then(() => {
          lastSinglePersistedSignatureRef.current = signature;
          setSingleSaveStatus('saved');
        })
        .catch((error) => {
          setSingleSaveStatus('error');
          setWorkspaceError((current) => current ?? getErrorMessage(error, t('singleTree.errorSaveViewState')));
        });
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTreeFileId,
    model.settings.tree,
    route.kind,
    selectedProject,
    setWorkspaceError,
    singleDocument,
    singleSelectedNodeId,
    singleViewStateSnapshot,
  ]);

  return {
    activeTreeFileId,
    singleDocument,
    singleViewStateSnapshot,
    singleSelectedNodeId,
    singleSaveStatus,
    editorText,
    originalText,
    contentSaveStatus,
    editorParseError,
    singleActionMessage,
    canUndoSingleHistory,
    canRedoSingleHistory,
    setSingleSelectedNodeId,
    setEditorText,
    handleOpenTree,
    handleToggleCollapseSelected,
    handleSetSelectedColor,
    handleClearSelectedColor,
    handleExpandAllSingle,
    handleRerootSelected,
    handleSwapSelectedChildren,
    handlePruneSelected,
    handleLadderizeSingle,
    handleUndoSingleHistory,
    handleRedoSingleHistory,
    handleRenderEditorText,
    handleSaveEditorText,
    handleRestoreOriginalText,
    clearIfDeleted,
    resetSingleTreeState,
  };
}

function isCollapsedLabel(snapshot: ViewStateSnapshot, nodeId: string): boolean {
  return snapshot.collapsed.includes(nodeId);
}

function buildLastOpenedTreeFileStorageKey(projectId: string): string {
  return `${LAST_OPENED_TREE_FILE_KEY_PREFIX}:${projectId}`;
}
