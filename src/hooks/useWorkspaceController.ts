import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RouteState } from '../app/routes';
import type { AppModel } from './useAppModel';
import { useI18n } from '../i18n/provider';
import { useSingleTreeDocument } from './useSingleTreeDocument';
import { useTanglegramDocument } from './useTanglegramDocument';
import {
  createManualProjectFile,
  deleteProjectFile,
  getProject,
  reorderProjectFiles,
  uploadProjectFile,
  type FileDto,
  type ManualTreeFormat,
  type ProjectDetailDto,
  type TanglegramOptimizeRequestDto,
  type TanglegramOptimizeResponseDto,
} from '../lib/api';
import { getErrorMessage } from '../utils/errors';
import type { ViewerDocument } from '../utils/viewer-document';
import type { TanglegramStateSnapshot, ViewStateSnapshot } from 'phylo-tree-lib';

interface WorkspaceBase {
  project: ProjectDetailDto;
  activeTreeFileId: string | null;
  activeFileIdA: string | null;
  activeFileIdB: string | null;
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
  documentA: ViewerDocument | null;
  documentB: ViewerDocument | null;
  isBusy: boolean;
  error: string | null;
  onBackToProject: () => void;
  onBackToProjects: () => void;
  onSingleSelectedNodeChange: (nodeId: string | null) => void;
  onEditorTextChange: (text: string) => void;
  onToggleCollapseSelected: () => void;
  onSetSelectedColor: (color: string) => void;
  onClearSelectedColor: () => void;
  onExpandAllSingle: () => void;
  onRerootSelected: () => Promise<void>;
  onSwapSelectedChildren: () => Promise<void>;
  onPruneSelected: () => Promise<void>;
  onLadderizeSingle: (direction: 'ascending' | 'descending') => Promise<void>;
  onUndoSingleHistory: () => Promise<void>;
  onRedoSingleHistory: () => Promise<void>;
  onRenderEditorText: () => Promise<void>;
  onSaveEditorText: () => Promise<void>;
  onRestoreOriginalText: () => Promise<void>;
  onOpenTree: (file: FileDto) => Promise<void>;
  onLoadToA: (file: FileDto) => Promise<void>;
  onLoadToB: (file: FileDto) => Promise<void>;
  onTanglegramSelectedNodeChange: (side: 'A' | 'B' | null, nodeId: string | null) => void;
  onFocusedTanglegramConnectionChange: (connectionKey: string) => void;
  onToggleCollapseSelectedTanglegram: () => void;
  onSwapSelectedChildrenTanglegram: () => Promise<void>;
  onSetSelectedColorTanglegram: (color: string) => void;
  onClearSelectedColorTanglegram: () => void;
  onToggleSelectedConnection: () => void;
  onOptimizeTanglegram: (payload: TanglegramOptimizeRequestDto) => Promise<void>;
  onApplyTanglegramOptimization: () => Promise<void>;
  onRestoreOriginalTanglegram: () => Promise<void>;
}

export type AppLayoutWorkspace = WorkspaceBase;

export type ControlPanelWorkspace = Pick<
  WorkspaceBase,
  | 'project'
  | 'activeTreeFileId'
  | 'activeFileIdA'
  | 'activeFileIdB'
  | 'isBusy'
  | 'error'
  | 'singleDocument'
  | 'singleSaveStatus'
  | 'singleSelectedNodeId'
  | 'singleViewStateSnapshot'
  | 'editorText'
  | 'originalText'
  | 'contentSaveStatus'
  | 'editorParseError'
  | 'singleActionMessage'
  | 'canUndoSingleHistory'
  | 'canRedoSingleHistory'
  | 'tanglegramSaveStatus'
  | 'tanglegramStateSnapshot'
  | 'tanglegramViewStateASnapshot'
  | 'tanglegramViewStateBSnapshot'
  | 'tanglegramSelectedSide'
  | 'tanglegramSelectedNodeId'
  | 'tanglegramMatchedConnectionKey'
  | 'tanglegramActionMessage'
  | 'tanglegramOptimizationStatus'
  | 'tanglegramOptimizationResult'
  | 'tanglegramOptimizationError'
  | 'tanglegramOptimizationApplyStatus'
  | 'tanglegramOptimizationApplyError'
  | 'documentA'
  | 'documentB'
  | 'onEditorTextChange'
  | 'onToggleCollapseSelected'
  | 'onSetSelectedColor'
  | 'onClearSelectedColor'
  | 'onExpandAllSingle'
  | 'onRerootSelected'
  | 'onSwapSelectedChildren'
  | 'onPruneSelected'
  | 'onLadderizeSingle'
  | 'onUndoSingleHistory'
  | 'onRedoSingleHistory'
  | 'onRenderEditorText'
  | 'onSaveEditorText'
  | 'onRestoreOriginalText'
  | 'onOpenTree'
  | 'onLoadToA'
  | 'onLoadToB'
  | 'onTanglegramSelectedNodeChange'
  | 'onFocusedTanglegramConnectionChange'
  | 'onToggleCollapseSelectedTanglegram'
  | 'onSwapSelectedChildrenTanglegram'
  | 'onSetSelectedColorTanglegram'
  | 'onClearSelectedColorTanglegram'
  | 'onToggleSelectedConnection'
  | 'onOptimizeTanglegram'
  | 'onApplyTanglegramOptimization'
  | 'onRestoreOriginalTanglegram'
>;

export type ViewerWorkspace = Pick<
  WorkspaceBase,
  | 'project'
  | 'activeTreeFileId'
  | 'activeFileIdA'
  | 'activeFileIdB'
  | 'singleDocument'
  | 'singleViewStateSnapshot'
  | 'singleSelectedNodeId'
  | 'onToggleCollapseSelected'
  | 'onSetSelectedColor'
  | 'onClearSelectedColor'
  | 'onExpandAllSingle'
  | 'onRerootSelected'
  | 'onSwapSelectedChildren'
  | 'onPruneSelected'
  | 'onLadderizeSingle'
  | 'tanglegramStateSnapshot'
  | 'tanglegramViewStateASnapshot'
  | 'tanglegramViewStateBSnapshot'
  | 'tanglegramSelectedSide'
  | 'tanglegramSelectedNodeId'
  | 'documentA'
  | 'documentB'
  | 'onSingleSelectedNodeChange'
  | 'onTanglegramSelectedNodeChange'
  | 'onFocusedTanglegramConnectionChange'
  | 'onOpenTree'
  | 'onLoadToA'
  | 'onLoadToB'
>;

interface UseWorkspaceControllerParams {
  route: RouteState;
  navigate: (next: RouteState, replace?: boolean) => void;
  model: AppModel;
}

interface UseWorkspaceControllerResult {
  selectedProject: ProjectDetailDto | null;
  workspaceBusy: boolean;
  workspaceError: string | null;
  uploadFeedback: { tone: 'idle' | 'progress' | 'success' | 'error'; message: string | null };
  workspace: WorkspaceBase | null;
  resetWorkspaceState: () => void;
  handleUploadFiles: (files: FileList | null) => Promise<void>;
  handleCreateManualFile: (name: string, content: string, format: ManualTreeFormat) => Promise<boolean>;
  handleDeleteFile: (file: FileDto) => Promise<void>;
  handleReorderFiles: (nextFileIds: string[]) => Promise<void>;
}

export function useWorkspaceController({
  route,
  navigate,
  model,
}: UseWorkspaceControllerParams): UseWorkspaceControllerResult {
  const { t } = useI18n();
  const [selectedProject, setSelectedProject] = useState<ProjectDetailDto | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<{
    tone: 'idle' | 'progress' | 'success' | 'error';
    message: string | null;
  }>({ tone: 'idle', message: null });
  const uploadFeedbackTimerRef = useRef<number | null>(null);

  const clearUploadFeedbackTimer = useCallback(() => {
    if (uploadFeedbackTimerRef.current !== null) {
      window.clearTimeout(uploadFeedbackTimerRef.current);
      uploadFeedbackTimerRef.current = null;
    }
  }, []);

  const scheduleUploadFeedbackClear = useCallback((delayMs = 2600) => {
    clearUploadFeedbackTimer();
    uploadFeedbackTimerRef.current = window.setTimeout(() => {
      setUploadFeedback({ tone: 'idle', message: null });
      uploadFeedbackTimerRef.current = null;
    }, delayMs);
  }, [clearUploadFeedbackTimer]);

  const handleProjectFileUpdated = useCallback((nextFile: FileDto) => {
    setSelectedProject((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        files: current.files.map((file) => (file.id === nextFile.id ? nextFile : file)),
      };
    });
  }, []);

  const refreshSelectedProject = useCallback(async (projectId?: string) => {
    const id = projectId ?? selectedProject?.project.id;
    if (!id) {
      return null;
    }
    const detail = await getProject(id);
    setSelectedProject(detail);
    return detail;
  }, [selectedProject?.project.id]);

  const singleTree = useSingleTreeDocument({
    route,
    navigate,
    model,
    selectedProject,
    setWorkspaceBusy,
    setWorkspaceError,
    onProjectFileUpdated: handleProjectFileUpdated,
  });

  const tanglegram = useTanglegramDocument({
    route,
    navigate,
    model,
    selectedProject,
    setWorkspaceBusy,
    setWorkspaceError,
    onProjectFileUpdated: handleProjectFileUpdated,
  });
  const { clearIfDeleted: clearSingleIfDeleted, resetSingleTreeState } = singleTree;
  const { clearIfDeleted: clearTanglegramIfDeleted, resetTanglegramState } = tanglegram;

  const resetWorkspaceState = useCallback(() => {
    setSelectedProject(null);
    setWorkspaceBusy(false);
    setWorkspaceError(null);
    clearUploadFeedbackTimer();
    setUploadFeedback({ tone: 'idle', message: null });
    resetSingleTreeState();
    resetTanglegramState();
  }, [clearUploadFeedbackTimer, resetSingleTreeState, resetTanglegramState]);

  useEffect(() => () => {
    clearUploadFeedbackTimer();
  }, [clearUploadFeedbackTimer]);

  useEffect(() => {
    if (route.kind !== 'project' && route.kind !== 'workspace') {
      return;
    }
    if (selectedProject?.project.id === route.projectId) {
      return;
    }

    let active = true;
    if (selectedProject && selectedProject.project.id !== route.projectId) {
      setSelectedProject(null);
      resetSingleTreeState();
      resetTanglegramState();
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    void getProject(route.projectId)
      .then((detail) => {
        if (active) {
          setSelectedProject(detail);
        }
      })
      .catch((error) => {
        if (active) {
          setWorkspaceError(getErrorMessage(error, 'Не удалось открыть проект.'));
        }
      })
      .finally(() => {
        if (active) {
          setWorkspaceBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    resetSingleTreeState,
    resetTanglegramState,
    route,
    selectedProject,
  ]);

  const handleUploadFiles = useCallback(async (files: FileList | null) => {
    if (!selectedProject || !files?.length) {
      return;
    }
    const uploadList = Array.from(files);
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    clearUploadFeedbackTimer();
    setUploadFeedback({
      tone: 'progress',
      message: uploadList.length === 1
        ? t('project.uploadProgressSingle', { name: uploadList[0].name })
        : t('project.uploadProgressMultiple', { count: uploadList.length }),
    });
    try {
      let uploadedCount = 0;
      for (const file of uploadList) {
        await uploadProjectFile(selectedProject.project.id, file);
        uploadedCount += 1;
        if (uploadedCount < uploadList.length) {
          setUploadFeedback({
            tone: 'progress',
            message: t('project.uploadProgressStep', {
              current: uploadedCount,
              total: uploadList.length,
              name: file.name,
            }),
          });
        }
      }
      await refreshSelectedProject(selectedProject.project.id);
      setUploadFeedback({
        tone: 'success',
        message: uploadList.length === 1
          ? t('project.uploadSuccessSingle', { name: uploadList[0].name })
          : t('project.uploadSuccessMultiple', { count: uploadList.length }),
      });
      scheduleUploadFeedbackClear();
    } catch (error) {
      const message = getErrorMessage(error, 'Не удалось загрузить файл.');
      setWorkspaceError(message);
      setUploadFeedback({ tone: 'error', message });
    } finally {
      setWorkspaceBusy(false);
    }
  }, [
    clearUploadFeedbackTimer,
    refreshSelectedProject,
    scheduleUploadFeedbackClear,
    selectedProject,
    t,
  ]);

  const handleCreateManualFile = useCallback(async (
    name: string,
    content: string,
    format: ManualTreeFormat
  ): Promise<boolean> => {
    if (!selectedProject || !content.trim()) {
      return false;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    clearUploadFeedbackTimer();
    setUploadFeedback({ tone: 'progress', message: t('project.manualProgress', { name }) });
    try {
      const created = await createManualProjectFile(selectedProject.project.id, {
        name,
        content,
        format,
      });
      await refreshSelectedProject(selectedProject.project.id);
      setUploadFeedback({ tone: 'success', message: t('project.manualSuccess', { name: created.name }) });
      scheduleUploadFeedbackClear();
      return true;
    } catch (error) {
      const message = getErrorMessage(error, t('project.manualError'));
      setWorkspaceError(message);
      setUploadFeedback({ tone: 'error', message });
      return false;
    } finally {
      setWorkspaceBusy(false);
    }
  }, [
    clearUploadFeedbackTimer,
    refreshSelectedProject,
    scheduleUploadFeedbackClear,
    selectedProject,
    t,
  ]);

  const handleDeleteFile = useCallback(async (file: FileDto) => {
    if (!selectedProject) {
      return;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    try {
      await deleteProjectFile(selectedProject.project.id, file.id);
      await refreshSelectedProject(selectedProject.project.id);
      clearSingleIfDeleted(file.id);
      clearTanglegramIfDeleted(file.id);
    } catch (error) {
      setWorkspaceError(getErrorMessage(error, 'Не удалось удалить файл.'));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [clearSingleIfDeleted, clearTanglegramIfDeleted, refreshSelectedProject, selectedProject]);

  const handleReorderFiles = useCallback(async (nextFileIds: string[]) => {
    if (!selectedProject) {
      return;
    }
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    try {
      const files = await reorderProjectFiles(selectedProject.project.id, nextFileIds);
      setSelectedProject((current) => (current ? { ...current, files } : current));
    } catch (error) {
      setWorkspaceError(getErrorMessage(error, 'Не удалось изменить порядок файлов.'));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [selectedProject]);

  const workspace = useMemo<WorkspaceBase | null>(() => {
    if (!selectedProject) {
      return null;
    }

    return {
      project: selectedProject,
      activeTreeFileId: singleTree.activeTreeFileId,
      activeFileIdA: tanglegram.activeFileIdA,
      activeFileIdB: tanglegram.activeFileIdB,
      singleDocument: singleTree.singleDocument,
      singleViewStateSnapshot: singleTree.singleViewStateSnapshot,
      singleSelectedNodeId: singleTree.singleSelectedNodeId,
      singleSaveStatus: singleTree.singleSaveStatus,
      editorText: singleTree.editorText,
      originalText: singleTree.originalText,
      contentSaveStatus: singleTree.contentSaveStatus,
      editorParseError: singleTree.editorParseError,
      singleActionMessage: singleTree.singleActionMessage,
      canUndoSingleHistory: singleTree.canUndoSingleHistory,
      canRedoSingleHistory: singleTree.canRedoSingleHistory,
      tanglegramStateSnapshot: tanglegram.tanglegramStateSnapshot,
      tanglegramViewStateASnapshot: tanglegram.tanglegramViewStateASnapshot,
      tanglegramViewStateBSnapshot: tanglegram.tanglegramViewStateBSnapshot,
      tanglegramSaveStatus: tanglegram.tanglegramSaveStatus,
      tanglegramSelectedSide: tanglegram.tanglegramSelectedSide,
      tanglegramSelectedNodeId: tanglegram.tanglegramSelectedNodeId,
      tanglegramMatchedConnectionKey: tanglegram.tanglegramMatchedConnectionKey,
      tanglegramActionMessage: tanglegram.tanglegramActionMessage,
      tanglegramOptimizationStatus: tanglegram.tanglegramOptimizationStatus,
      tanglegramOptimizationResult: tanglegram.tanglegramOptimizationResult,
      tanglegramOptimizationError: tanglegram.tanglegramOptimizationError,
      tanglegramOptimizationApplyStatus: tanglegram.tanglegramOptimizationApplyStatus,
      tanglegramOptimizationApplyError: tanglegram.tanglegramOptimizationApplyError,
      documentA: tanglegram.documentA,
      documentB: tanglegram.documentB,
      isBusy: workspaceBusy,
      error: workspaceError,
      onBackToProject: () => navigate({ kind: 'project', projectId: selectedProject.project.id }),
      onBackToProjects: () => {
        setSelectedProject(null);
        navigate({ kind: 'projects' });
      },
      onSingleSelectedNodeChange: singleTree.setSingleSelectedNodeId,
      onEditorTextChange: singleTree.setEditorText,
      onToggleCollapseSelected: singleTree.handleToggleCollapseSelected,
      onSetSelectedColor: singleTree.handleSetSelectedColor,
      onClearSelectedColor: singleTree.handleClearSelectedColor,
      onExpandAllSingle: singleTree.handleExpandAllSingle,
      onRerootSelected: singleTree.handleRerootSelected,
      onSwapSelectedChildren: singleTree.handleSwapSelectedChildren,
      onPruneSelected: singleTree.handlePruneSelected,
      onLadderizeSingle: singleTree.handleLadderizeSingle,
      onUndoSingleHistory: singleTree.handleUndoSingleHistory,
      onRedoSingleHistory: singleTree.handleRedoSingleHistory,
      onRenderEditorText: singleTree.handleRenderEditorText,
      onSaveEditorText: singleTree.handleSaveEditorText,
      onRestoreOriginalText: singleTree.handleRestoreOriginalText,
      onOpenTree: singleTree.handleOpenTree,
      onLoadToA: tanglegram.handleLoadToA,
      onLoadToB: tanglegram.handleLoadToB,
      onTanglegramSelectedNodeChange: tanglegram.setTanglegramSelectedNode,
      onFocusedTanglegramConnectionChange: tanglegram.handleFocusedConnection,
      onToggleCollapseSelectedTanglegram: tanglegram.handleToggleCollapseSelected,
      onSwapSelectedChildrenTanglegram: tanglegram.handleSwapSelectedChildren,
      onSetSelectedColorTanglegram: tanglegram.handleSetSelectedColor,
      onClearSelectedColorTanglegram: tanglegram.handleClearSelectedColor,
      onToggleSelectedConnection: tanglegram.handleToggleSelectedConnection,
      onOptimizeTanglegram: tanglegram.handleOptimizeTanglegram,
      onApplyTanglegramOptimization: tanglegram.handleApplyTanglegramOptimization,
      onRestoreOriginalTanglegram: tanglegram.handleRestoreOriginalTanglegram,
    };
  }, [
    navigate,
    selectedProject,
    singleTree,
    tanglegram,
    workspaceBusy,
    workspaceError,
  ]);

  return {
    selectedProject,
    workspaceBusy,
    workspaceError,
    uploadFeedback,
    workspace,
    resetWorkspaceState,
    handleUploadFiles,
    handleCreateManualFile,
    handleDeleteFile,
    handleReorderFiles,
  };
}
