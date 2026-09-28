import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { RouteState } from '../app/routes';
import type { AppModel } from './useAppModel';
import { useI18n } from '../i18n/provider';
import {
  clearProjectWorkingCopy,
  getProjectFile,
  getProjectTanglegramState,
  optimizeProjectTanglegram,
  putProjectTanglegramState,
  updateProjectWorkingCopy,
  type FileDto,
  type ProjectDetailDto,
  type TanglegramOptimizeRequestDto,
  type TanglegramOptimizeResponseDto,
} from '../lib/api';
import { getErrorMessage } from '../utils/errors';
import { filterViewerSupportedFiles, isViewerSupportedFormat } from '../utils/formats';
import {
  buildTanglegramStateSignature,
  emptyPersistedTanglegramViewerState,
  mergeTanglegramRenderOptions,
  normalizePersistedTanglegramViewerState,
  normalizeViewStateSnapshot,
} from '../utils/viewer-persistence';
import { buildViewerDocumentFromContent, type ViewerDocument } from '../utils/viewer-document';
import {
  applyTanglegramSideViewAction,
  buildTanglegramPairs,
  PhyloTreeModel,
  TanglegramState,
  ViewState,
  type TanglegramStateSnapshot,
  type ViewStateSnapshot,
} from 'phylo-tree-lib';

interface UseTanglegramDocumentParams {
  route: RouteState;
  navigate: (next: RouteState, replace?: boolean) => void;
  model: AppModel;
  selectedProject: ProjectDetailDto | null;
  setWorkspaceBusy: (busy: boolean) => void;
  setWorkspaceError: Dispatch<SetStateAction<string | null>>;
  onProjectFileUpdated: (nextFile: FileDto) => void;
}

interface UseTanglegramDocumentResult {
  activeFileIdA: string | null;
  activeFileIdB: string | null;
  documentA: ViewerDocument | null;
  documentB: ViewerDocument | null;
  tanglegramStateSnapshot: TanglegramStateSnapshot | null;
  tanglegramViewStateASnapshot: ViewStateSnapshot | null;
  tanglegramViewStateBSnapshot: ViewStateSnapshot | null;
  tanglegramSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  tanglegramSelectedSide: 'A' | 'B' | null;
  tanglegramSelectedNodeId: string | null;
  tanglegramMatchedConnectionKey: string | null;
  tanglegramActionMessage: string | null;
  tanglegramOptimizationStatus: 'idle' | 'running' | 'success' | 'error';
  tanglegramOptimizationResult: TanglegramOptimizeResponseDto | null;
  tanglegramOptimizationError: string | null;
  tanglegramOptimizationApplyStatus: 'idle' | 'applying' | 'applied' | 'restoring' | 'restored' | 'error';
  tanglegramOptimizationApplyError: string | null;
  setTanglegramSelectedNode: (side: 'A' | 'B' | null, nodeId: string | null) => void;
  handleToggleCollapseSelected: () => void;
  handleSwapSelectedChildren: () => Promise<void>;
  handleSetSelectedColor: (color: string) => void;
  handleClearSelectedColor: () => void;
  handleToggleSelectedConnection: () => void;
  handleFocusedConnection: (connectionKey: string) => void;
  handleOptimizeTanglegram: (payload: TanglegramOptimizeRequestDto) => Promise<void>;
  handleApplyTanglegramOptimization: () => Promise<void>;
  handleRestoreOriginalTanglegram: () => Promise<void>;
  handleLoadToA: (file: FileDto) => Promise<void>;
  handleLoadToB: (file: FileDto) => Promise<void>;
  clearIfDeleted: (fileId: string) => void;
  resetTanglegramState: () => void;
}

export function useTanglegramDocument({
  route,
  navigate,
  model,
  selectedProject,
  setWorkspaceBusy,
  setWorkspaceError,
  onProjectFileUpdated,
}: UseTanglegramDocumentParams): UseTanglegramDocumentResult {
  const { t } = useI18n();
  const selectedProjectId = selectedProject?.project.id ?? null;
  const [activeFileIdA, setActiveFileIdA] = useState<string | null>(null);
  const [activeFileIdB, setActiveFileIdB] = useState<string | null>(null);
  const [documentA, setDocumentA] = useState<ViewerDocument | null>(null);
  const [documentB, setDocumentB] = useState<ViewerDocument | null>(null);
  const [tanglegramStateSnapshot, setTanglegramStateSnapshot] = useState<TanglegramStateSnapshot | null>(null);
  const [tanglegramViewStateASnapshot, setTanglegramViewStateASnapshot] = useState<ViewStateSnapshot | null>(null);
  const [tanglegramViewStateBSnapshot, setTanglegramViewStateBSnapshot] = useState<ViewStateSnapshot | null>(null);
  const [tanglegramSaveStatus, setTanglegramSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [tanglegramActionMessage, setTanglegramActionMessage] = useState<string | null>(null);
  const [tanglegramOptimizationStatus, setTanglegramOptimizationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [tanglegramOptimizationResult, setTanglegramOptimizationResult] = useState<TanglegramOptimizeResponseDto | null>(null);
  const [tanglegramOptimizationError, setTanglegramOptimizationError] = useState<string | null>(null);
  const [tanglegramOptimizationApplyStatus, setTanglegramOptimizationApplyStatus] = useState<'idle' | 'applying' | 'applied' | 'restoring' | 'restored' | 'error'>('idle');
  const [tanglegramOptimizationApplyError, setTanglegramOptimizationApplyError] = useState<string | null>(null);
  const optimizationRequestIdRef = useRef(0);
  const activeTanglegramPairRef = useRef<{ fileAId: string | null; fileBId: string | null }>({
    fileAId: null,
    fileBId: null,
  });
  const lastTanglegramPersistedSignatureRef = useRef<string | null>(null);
  const tanglegramSelectedSide = tanglegramStateSnapshot?.selectedSide ?? null;
  const tanglegramSelectedNodeId = tanglegramStateSnapshot?.selectedNodeId ?? null;
  activeTanglegramPairRef.current = { fileAId: activeFileIdA, fileBId: activeFileIdB };

  const tanglegramMatchedConnectionKey = useMemo(() => {
    if (!documentA?.tree || !documentB?.tree || !tanglegramSelectedSide || !tanglegramSelectedNodeId) {
      return null;
    }
    const pairs = buildTanglegramPairs(documentA.tree, documentB.tree);
    const pair = pairs.find((entry) =>
      tanglegramSelectedSide === 'A'
        ? entry.sideA.nodeId === tanglegramSelectedNodeId
        : entry.sideB.nodeId === tanglegramSelectedNodeId
    );
    return pair?.key ?? null;
  }, [documentA?.tree, documentB?.tree, tanglegramSelectedNodeId, tanglegramSelectedSide]);

  const resetTanglegramState = useCallback(() => {
    setActiveFileIdA(null);
    setActiveFileIdB(null);
    setDocumentA(null);
    setDocumentB(null);
    setTanglegramStateSnapshot(null);
    setTanglegramViewStateASnapshot(null);
    setTanglegramViewStateBSnapshot(null);
    setTanglegramSaveStatus('idle');
    setTanglegramActionMessage(null);
    setTanglegramOptimizationStatus('idle');
    setTanglegramOptimizationResult(null);
    setTanglegramOptimizationError(null);
    setTanglegramOptimizationApplyStatus('idle');
    setTanglegramOptimizationApplyError(null);
    lastTanglegramPersistedSignatureRef.current = null;
  }, []);

  const resetOptimizationPreview = useCallback(() => {
    optimizationRequestIdRef.current += 1;
    setTanglegramOptimizationStatus('idle');
    setTanglegramOptimizationResult(null);
    setTanglegramOptimizationError(null);
    setTanglegramOptimizationApplyStatus('idle');
    setTanglegramOptimizationApplyError(null);
  }, []);

  const setTanglegramSelectedNode = useCallback((side: 'A' | 'B' | null, nodeId: string | null) => {
    setTanglegramStateSnapshot((current) => {
      const base = TanglegramState.fromJSON(current);
      if (!side || !nodeId) {
        return base.clearSelection().clearFocus().toJSON();
      }
      const next = base.selectedSide === side && base.selectedNodeId === nodeId
        ? base.clearSelection().clearFocus()
        : base.selectNode(side, nodeId).clearFocus();
      return next.toJSON();
    });
  }, []);

  const updateTanglegramState = useCallback((
    updater: (state: TanglegramState) => TanglegramState,
    message: string
  ) => {
    setTanglegramStateSnapshot((current) => {
      const base = TanglegramState.fromJSON(current);
      const next = updater(base).toJSON();
      if (JSON.stringify(next) !== JSON.stringify(base.toJSON())) {
        setTanglegramActionMessage(message);
      }
      return next;
    });
  }, []);

  const updateTanglegramViewStates = useCallback((
    updater: (states: { viewStateA: ViewState; viewStateB: ViewState }) => { viewStateA: ViewState; viewStateB: ViewState },
    message: string
  ) => {
    const next = updater({
      viewStateA: ViewState.fromJSON(tanglegramViewStateASnapshot),
      viewStateB: ViewState.fromJSON(tanglegramViewStateBSnapshot),
    });
    const nextSnapshotA = next.viewStateA.toJSON();
    const nextSnapshotB = next.viewStateB.toJSON();
    const changed =
      JSON.stringify(nextSnapshotA) !== JSON.stringify(ViewState.fromJSON(tanglegramViewStateASnapshot).toJSON()) ||
      JSON.stringify(nextSnapshotB) !== JSON.stringify(ViewState.fromJSON(tanglegramViewStateBSnapshot).toJSON());
    if (changed) {
      setTanglegramViewStateASnapshot(nextSnapshotA);
      setTanglegramViewStateBSnapshot(nextSnapshotB);
      setTanglegramActionMessage(message);
    }
  }, [tanglegramViewStateASnapshot, tanglegramViewStateBSnapshot]);

  const handleToggleCollapseSelected = useCallback(() => {
    if (!tanglegramSelectedSide || !tanglegramSelectedNodeId) {
      return;
    }
    updateTanglegramViewStates(
      (states) => applyTanglegramSideViewAction(states, tanglegramSelectedSide, {
        type: 'toggleCollapse',
        nodeId: tanglegramSelectedNodeId,
      }),
      t('tanglegram.actionCollapseUpdated', { side: tanglegramSelectedSide })
    );
  }, [tanglegramSelectedNodeId, tanglegramSelectedSide, updateTanglegramViewStates]);

  const handleSetSelectedColor = useCallback((color: string) => {
    if (!tanglegramSelectedSide || !tanglegramSelectedNodeId) {
      return;
    }
    updateTanglegramViewStates(
      (states) => applyTanglegramSideViewAction(states, tanglegramSelectedSide, {
        type: 'setColor',
        nodeId: tanglegramSelectedNodeId,
        color,
      }),
      t('tanglegram.actionColorUpdated', { side: tanglegramSelectedSide })
    );
  }, [tanglegramSelectedNodeId, tanglegramSelectedSide, updateTanglegramViewStates]);

  const handleClearSelectedColor = useCallback(() => {
    if (!tanglegramSelectedSide || !tanglegramSelectedNodeId) {
      return;
    }
    updateTanglegramViewStates(
      (states) => applyTanglegramSideViewAction(states, tanglegramSelectedSide, {
        type: 'clearColor',
        nodeId: tanglegramSelectedNodeId,
      }),
      t('tanglegram.actionColorCleared', { side: tanglegramSelectedSide })
    );
  }, [tanglegramSelectedNodeId, tanglegramSelectedSide, updateTanglegramViewStates]);

  const handleToggleSelectedConnection = useCallback(() => {
    if (!tanglegramMatchedConnectionKey) {
      return;
    }
    updateTanglegramState((state) => (
      state.isConnectionHidden(tanglegramMatchedConnectionKey)
        ? state.showConnection(tanglegramMatchedConnectionKey)
        : state.hideConnection(tanglegramMatchedConnectionKey)
    ), t('tanglegram.actionConnectionVisibility'));
  }, [tanglegramMatchedConnectionKey, updateTanglegramState]);

  const handleFocusedConnection = useCallback((connectionKey: string) => {
    updateTanglegramState(
      (state) => state.toggleFocusedConnection(connectionKey),
      t('tanglegram.actionFocusedConnection')
    );
  }, [updateTanglegramState]);

  useEffect(() => {
    if (!selectedProject || !selectedProjectId || route.kind !== 'workspace') {
      return;
    }

    let active = true;
    void getProjectTanglegramState(selectedProjectId)
      .then(async (state) => {
        if (!active) {
          return;
        }

        const supportedFiles = filterViewerSupportedFiles(selectedProject.files);
        const fileA = state.treeAId ? supportedFiles.find((file) => file.id === state.treeAId) ?? null : null;
        const fileB = state.treeBId ? supportedFiles.find((file) => file.id === state.treeBId) ?? null : null;

        const [contentA, contentB] = await Promise.all([
          fileA ? getProjectFile(selectedProject.project.id, fileA.id) : Promise.resolve(null),
          fileB ? getProjectFile(selectedProject.project.id, fileB.id) : Promise.resolve(null),
        ]);

        if (!active) {
          return;
        }

        setDocumentA(contentA ? buildViewerDocumentFromContent(contentA) : null);
        setDocumentB(contentB ? buildViewerDocumentFromContent(contentB) : null);
        setActiveFileIdA(fileA?.id ?? null);
        setActiveFileIdB(fileB?.id ?? null);
        setTanglegramActionMessage(null);
        const normalizedState = normalizePersistedTanglegramViewerState(state.stateJson);
        const mergedOptions = mergeTanglegramRenderOptions(state.renderOptionsJson);
        setTanglegramStateSnapshot(normalizedState.compareState);
        setTanglegramViewStateASnapshot(normalizedState.viewStateA);
        setTanglegramViewStateBSnapshot(normalizedState.viewStateB);
        model.settings.replaceTanglegram(mergedOptions);
        lastTanglegramPersistedSignatureRef.current = buildTanglegramStateSignature(
          fileA?.id ?? null,
          fileB?.id ?? null,
          normalizedState,
          mergedOptions
        );
        setTanglegramSaveStatus('idle');
        resetOptimizationPreview();
      })
      .catch(() => {
        if (active) {
          setDocumentA(null);
          setDocumentB(null);
          setActiveFileIdA(null);
          setActiveFileIdB(null);
          const emptyState = emptyPersistedTanglegramViewerState();
          setTanglegramStateSnapshot(emptyState.compareState);
          setTanglegramViewStateASnapshot(emptyState.viewStateA);
          setTanglegramViewStateBSnapshot(emptyState.viewStateB);
          setTanglegramSaveStatus('idle');
          setTanglegramActionMessage(null);
          resetOptimizationPreview();
          lastTanglegramPersistedSignatureRef.current = null;
        }
      });

    return () => {
      active = false;
    };
  }, [model.settings.replaceTanglegram, resetOptimizationPreview, route.kind, selectedProjectId]);

  const loadSide = useCallback(async (file: FileDto, side: 'A' | 'B') => {
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
      const fileContent = await getProjectFile(selectedProject.project.id, file.id);
      model.actions.setMode('tanglegram');
      if (side === 'A') {
        setDocumentA(buildViewerDocumentFromContent(fileContent));
        setActiveFileIdA(file.id);
      } else {
        setDocumentB(buildViewerDocumentFromContent(fileContent));
        setActiveFileIdB(file.id);
      }
      setTanglegramStateSnapshot((current) => TanglegramState.fromJSON(current).clearSelection().clearFocus().toJSON());
      setTanglegramViewStateASnapshot((current) => current ?? normalizeViewStateSnapshot({}));
      setTanglegramViewStateBSnapshot((current) => current ?? normalizeViewStateSnapshot({}));
      setTanglegramActionMessage(null);
      setTanglegramSaveStatus('idle');
      resetOptimizationPreview();
      if (route.kind !== 'workspace') {
        navigate({ kind: 'workspace', projectId: selectedProject.project.id });
      }
    } catch (error) {
      setWorkspaceError(getErrorMessage(error, side === 'A' ? t('tanglegram.errorLoadA') : t('tanglegram.errorLoadB')));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [model.actions, navigate, resetOptimizationPreview, route.kind, selectedProject, setWorkspaceBusy, setWorkspaceError]);

  const handleLoadToA = useCallback(async (file: FileDto) => {
    await loadSide(file, 'A');
  }, [loadSide]);

  const handleLoadToB = useCallback(async (file: FileDto) => {
    await loadSide(file, 'B');
  }, [loadSide]);

  const clearIfDeleted = useCallback((fileId: string) => {
    if (activeFileIdA === fileId) {
      setActiveFileIdA(null);
      setDocumentA(null);
      setTanglegramStateSnapshot((current) => TanglegramState.fromJSON(current).clearSelection().clearFocus().toJSON());
      setTanglegramViewStateASnapshot(null);
      setTanglegramSaveStatus('idle');
      resetOptimizationPreview();
    }
    if (activeFileIdB === fileId) {
      setActiveFileIdB(null);
      setDocumentB(null);
      setTanglegramStateSnapshot((current) => TanglegramState.fromJSON(current).clearSelection().clearFocus().toJSON());
      setTanglegramViewStateBSnapshot(null);
      setTanglegramSaveStatus('idle');
      resetOptimizationPreview();
    }
  }, [activeFileIdA, activeFileIdB, resetOptimizationPreview]);

  const handleOptimizeTanglegram = useCallback(async (payload: TanglegramOptimizeRequestDto) => {
    if (!selectedProjectId || !activeFileIdA || !activeFileIdB) {
      return;
    }
    const requestId = optimizationRequestIdRef.current + 1;
    optimizationRequestIdRef.current = requestId;
    setTanglegramOptimizationStatus('running');
    setTanglegramOptimizationResult(null);
    setTanglegramOptimizationError(null);
    setTanglegramOptimizationApplyStatus('idle');
    setTanglegramOptimizationApplyError(null);
    try {
      const result = await optimizeProjectTanglegram(selectedProjectId, {
        ...payload,
        treeAId: activeFileIdA,
        treeBId: activeFileIdB,
      });
      if (optimizationRequestIdRef.current !== requestId) {
        return;
      }
      setTanglegramOptimizationResult(result);
      setTanglegramOptimizationStatus('success');
    } catch (error) {
      if (optimizationRequestIdRef.current !== requestId) {
        return;
      }
      setTanglegramOptimizationError(getErrorMessage(error, t('tanglegram.optimizeError')));
      setTanglegramOptimizationStatus('error');
    }
  }, [activeFileIdA, activeFileIdB, selectedProjectId, t]);

  const resetTanglegramInteractionState = useCallback(() => {
    const emptyState = emptyPersistedTanglegramViewerState();
    setTanglegramStateSnapshot(emptyState.compareState);
    setTanglegramViewStateASnapshot(emptyState.viewStateA);
    setTanglegramViewStateBSnapshot(emptyState.viewStateB);
  }, []);

  const handleSwapSelectedChildren = useCallback(async () => {
    if (!selectedProjectId || !tanglegramSelectedSide || !tanglegramSelectedNodeId) {
      return;
    }
    const document = tanglegramSelectedSide === 'A' ? documentA : documentB;
    const fileId = tanglegramSelectedSide === 'A' ? activeFileIdA : activeFileIdB;
    const selectedNode = document?.tree
      ? new PhyloTreeModel(document.tree).findById(tanglegramSelectedNodeId)
      : null;
    if (!document?.tree || !fileId || !selectedNode || selectedNode.children.length < 2) {
      return;
    }

    const side = tanglegramSelectedSide;
    const pair = { fileAId: activeFileIdA, fileBId: activeFileIdB };
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    try {
      const updatedTree = new PhyloTreeModel(document.tree).swapChildren(tanglegramSelectedNodeId);
      const updatedFile = await updateProjectWorkingCopy(
        selectedProjectId,
        fileId,
        new PhyloTreeModel(updatedTree).toNewick()
      );
      if (
        activeTanglegramPairRef.current.fileAId !== pair.fileAId ||
        activeTanglegramPairRef.current.fileBId !== pair.fileBId
      ) {
        return;
      }
      if (side === 'A') {
        setDocumentA(buildViewerDocumentFromContent(updatedFile));
      } else {
        setDocumentB(buildViewerDocumentFromContent(updatedFile));
      }
      onProjectFileUpdated(updatedFile);
      resetTanglegramInteractionState();
      resetOptimizationPreview();
      setTanglegramActionMessage(t('tanglegram.actionSwappedChildren', { side }));
    } catch (error) {
      setWorkspaceError(getErrorMessage(error, t('tanglegram.errorSwapChildren')));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [
    activeFileIdA,
    activeFileIdB,
    documentA,
    documentB,
    onProjectFileUpdated,
    resetOptimizationPreview,
    resetTanglegramInteractionState,
    selectedProjectId,
    setWorkspaceBusy,
    setWorkspaceError,
    t,
    tanglegramSelectedNodeId,
    tanglegramSelectedSide,
  ]);

  const handleApplyTanglegramOptimization = useCallback(async () => {
    if (!selectedProjectId || !activeFileIdA || !activeFileIdB || !tanglegramOptimizationResult) {
      return;
    }
    if (
      tanglegramOptimizationResult.treeAId !== activeFileIdA ||
      tanglegramOptimizationResult.treeBId !== activeFileIdB
    ) {
      setTanglegramOptimizationApplyStatus('error');
      setTanglegramOptimizationApplyError(t('tanglegram.optimizePreviewExpired'));
      return;
    }
    const pair = { fileAId: activeFileIdA, fileBId: activeFileIdB };
    setTanglegramOptimizationApplyStatus('applying');
    setTanglegramOptimizationApplyError(null);
    try {
      const [updatedA, updatedB] = await Promise.all([
        updateProjectWorkingCopy(
          selectedProjectId,
          pair.fileAId,
          tanglegramOptimizationResult.optimizedTreeA.newick
        ),
        updateProjectWorkingCopy(
          selectedProjectId,
          pair.fileBId,
          tanglegramOptimizationResult.optimizedTreeB.newick
        ),
      ]);
      if (
        activeTanglegramPairRef.current.fileAId !== pair.fileAId ||
        activeTanglegramPairRef.current.fileBId !== pair.fileBId
      ) {
        return;
      }
      setDocumentA(buildViewerDocumentFromContent(updatedA));
      setDocumentB(buildViewerDocumentFromContent(updatedB));
      onProjectFileUpdated(updatedA);
      onProjectFileUpdated(updatedB);
      resetTanglegramInteractionState();
      setTanglegramOptimizationApplyStatus('applied');
      setTanglegramActionMessage(t('tanglegram.optimizeApplied'));
    } catch (error) {
      setTanglegramOptimizationApplyStatus('error');
      setTanglegramOptimizationApplyError(getErrorMessage(error, t('tanglegram.optimizeApplyError')));
    }
  }, [
    activeFileIdA,
    activeFileIdB,
    onProjectFileUpdated,
    resetTanglegramInteractionState,
    selectedProjectId,
    t,
    tanglegramOptimizationResult,
  ]);

  const handleRestoreOriginalTanglegram = useCallback(async () => {
    if (!selectedProjectId || !activeFileIdA || !activeFileIdB) {
      return;
    }
    const pair = { fileAId: activeFileIdA, fileBId: activeFileIdB };
    optimizationRequestIdRef.current += 1;
    setTanglegramOptimizationApplyStatus('restoring');
    setTanglegramOptimizationApplyError(null);
    try {
      const [restoredA, restoredB] = await Promise.all([
        clearProjectWorkingCopy(selectedProjectId, pair.fileAId),
        clearProjectWorkingCopy(selectedProjectId, pair.fileBId),
      ]);
      if (
        activeTanglegramPairRef.current.fileAId !== pair.fileAId ||
        activeTanglegramPairRef.current.fileBId !== pair.fileBId
      ) {
        return;
      }
      setDocumentA(buildViewerDocumentFromContent(restoredA));
      setDocumentB(buildViewerDocumentFromContent(restoredB));
      onProjectFileUpdated(restoredA);
      onProjectFileUpdated(restoredB);
      resetTanglegramInteractionState();
      setTanglegramOptimizationStatus('idle');
      setTanglegramOptimizationResult(null);
      setTanglegramOptimizationError(null);
      setTanglegramOptimizationApplyStatus('restored');
      setTanglegramActionMessage(t('tanglegram.optimizeOriginalsRestored'));
    } catch (error) {
      setTanglegramOptimizationApplyStatus('error');
      setTanglegramOptimizationApplyError(getErrorMessage(error, t('tanglegram.optimizeRestoreError')));
    }
  }, [
    activeFileIdA,
    activeFileIdB,
    onProjectFileUpdated,
    resetTanglegramInteractionState,
    selectedProjectId,
    t,
  ]);

  useEffect(() => {
    if (route.kind !== 'workspace' || !selectedProjectId) {
      return;
    }

    const stateSnapshot = {
      compareState: tanglegramStateSnapshot ?? emptyPersistedTanglegramViewerState().compareState,
      viewStateA: tanglegramViewStateASnapshot ?? emptyPersistedTanglegramViewerState().viewStateA,
      viewStateB: tanglegramViewStateBSnapshot ?? emptyPersistedTanglegramViewerState().viewStateB,
    };
    const signature = buildTanglegramStateSignature(activeFileIdA, activeFileIdB, stateSnapshot, model.settings.tanglegram);

    if (lastTanglegramPersistedSignatureRef.current === signature) {
      return;
    }

    setTanglegramSaveStatus('saving');
    const timeoutId = window.setTimeout(() => {
      void putProjectTanglegramState(selectedProjectId, {
        treeAId: activeFileIdA,
        treeBId: activeFileIdB,
        stateJson: stateSnapshot as unknown as Record<string, unknown>,
        renderOptionsJson: model.settings.tanglegram as unknown as Record<string, unknown>,
      })
        .then(() => {
          lastTanglegramPersistedSignatureRef.current = signature;
          setTanglegramSaveStatus('saved');
        })
        .catch((error) => {
          setTanglegramSaveStatus('error');
          setWorkspaceError((current) => current ?? getErrorMessage(error, t('tanglegram.errorSaveState')));
        });
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeFileIdA,
    activeFileIdB,
    model.settings.tanglegram,
    route.kind,
    selectedProjectId,
    setWorkspaceError,
    tanglegramStateSnapshot,
    tanglegramViewStateASnapshot,
    tanglegramViewStateBSnapshot,
  ]);

  return {
    activeFileIdA,
    activeFileIdB,
    documentA,
    documentB,
    tanglegramStateSnapshot,
    tanglegramViewStateASnapshot,
    tanglegramViewStateBSnapshot,
    tanglegramSaveStatus,
    tanglegramSelectedSide,
    tanglegramSelectedNodeId,
    tanglegramMatchedConnectionKey,
    tanglegramActionMessage,
    tanglegramOptimizationStatus,
    tanglegramOptimizationResult,
    tanglegramOptimizationError,
    tanglegramOptimizationApplyStatus,
    tanglegramOptimizationApplyError,
    setTanglegramSelectedNode,
    handleToggleCollapseSelected,
    handleSwapSelectedChildren,
    handleSetSelectedColor,
    handleClearSelectedColor,
    handleToggleSelectedConnection,
    handleFocusedConnection,
    handleOptimizeTanglegram,
    handleApplyTanglegramOptimization,
    handleRestoreOriginalTanglegram,
    handleLoadToA,
    handleLoadToB,
    clearIfDeleted,
    resetTanglegramState,
  };
}
