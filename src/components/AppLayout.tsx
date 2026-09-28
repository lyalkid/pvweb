import { useRef } from 'react';
import { PhyloTreeModel } from 'phylo-tree-lib';
import type { AppModel, ViewerCommands } from '../hooks/useAppModel';
import type { AppLayoutWorkspace, ViewerWorkspace } from '../hooks/useWorkspaceController';
import { AppSidebar } from './AppSidebar';
import { ControlPanel } from './ControlPanel';
import { FixedControls, type NewickExportFile } from './FixedControls';
import { ViewerPanel } from './ViewerPanel';

interface AppLayoutProps {
  model: AppModel;
  workspace: AppLayoutWorkspace;
}

export function AppLayout({ model, workspace }: AppLayoutProps) {
  const viewerRef = useRef<ViewerCommands | null>(null);
  const exportConfig = buildExportConfig(model.layout.mode, workspace);

  const viewerWorkspace: ViewerWorkspace = {
    project: workspace.project,
    activeTreeFileId: workspace.activeTreeFileId,
    activeFileIdA: workspace.activeFileIdA,
    activeFileIdB: workspace.activeFileIdB,
    singleDocument: workspace.singleDocument,
    singleViewStateSnapshot: workspace.singleViewStateSnapshot,
    singleSelectedNodeId: workspace.singleSelectedNodeId,
    onToggleCollapseSelected: workspace.onToggleCollapseSelected,
    onSetSelectedColor: workspace.onSetSelectedColor,
    onClearSelectedColor: workspace.onClearSelectedColor,
    onExpandAllSingle: workspace.onExpandAllSingle,
    onRerootSelected: workspace.onRerootSelected,
    onSwapSelectedChildren: workspace.onSwapSelectedChildren,
    onPruneSelected: workspace.onPruneSelected,
    onLadderizeSingle: workspace.onLadderizeSingle,
    tanglegramStateSnapshot: workspace.tanglegramStateSnapshot,
    tanglegramViewStateASnapshot: workspace.tanglegramViewStateASnapshot,
    tanglegramViewStateBSnapshot: workspace.tanglegramViewStateBSnapshot,
    tanglegramSelectedSide: workspace.tanglegramSelectedSide,
    tanglegramSelectedNodeId: workspace.tanglegramSelectedNodeId,
    documentA: workspace.documentA,
    documentB: workspace.documentB,
    onSingleSelectedNodeChange: workspace.onSingleSelectedNodeChange,
    onTanglegramSelectedNodeChange: workspace.onTanglegramSelectedNodeChange,
    onFocusedTanglegramConnectionChange: workspace.onFocusedTanglegramConnectionChange,
    onOpenTree: workspace.onOpenTree,
    onLoadToA: workspace.onLoadToA,
    onLoadToB: workspace.onLoadToB,
  };

  return (
    <div className={`app-shell-root theme-${model.layout.theme}`}>
      <AppSidebar
        model={model}
        onBackToProject={workspace.onBackToProject}
        onBackToProjects={workspace.onBackToProjects}
      />
      <div className="app-shell">
        <main className="app-main">
          <ControlPanel model={model} workspace={workspace} />
          <ViewerPanel
            model={model}
            viewerRef={viewerRef}
            workspace={viewerWorkspace}
          />
        </main>
      </div>
      <FixedControls
        mode={model.layout.mode}
        canRenderTree={Boolean(workspace.singleDocument?.tree)}
        canRenderTanglegram={Boolean(workspace.documentA?.tree && workspace.documentB?.tree)}
        isOptimizingTanglegram={workspace.tanglegramOptimizationStatus === 'running'}
        canUndoTreeHistory={workspace.canUndoSingleHistory}
        canRedoTreeHistory={workspace.canRedoSingleHistory}
        onUndoTreeHistory={workspace.onUndoSingleHistory}
        onRedoTreeHistory={workspace.onRedoSingleHistory}
        onOptimizeTanglegram={() => workspace.onOptimizeTanglegram({ mode: 'auto' })}
        exportVisualBaseName={exportConfig.visualBaseName}
        newickExportFiles={exportConfig.newickFiles}
        viewerRef={viewerRef}
      />
    </div>
  );
}

function buildExportConfig(
  mode: AppModel['layout']['mode'],
  workspace: AppLayoutWorkspace
): { visualBaseName: string; newickFiles: NewickExportFile[] } {
  if (mode === 'tree') {
    const document = workspace.singleDocument;
    const baseName = getBaseName(document?.file.name ?? 'tree');
    return {
      visualBaseName: `${baseName}-view`,
      newickFiles: document?.tree
        ? [{ fileName: `${baseName}.nwk`, content: new PhyloTreeModel(document.tree).toNewick() }]
        : [],
    };
  }

  const documentA = workspace.documentA;
  const documentB = workspace.documentB;
  const baseNameA = getBaseName(documentA?.file.name ?? 'tree-A');
  const baseNameB = getBaseName(documentB?.file.name ?? 'tree-B');
  const newickFiles: NewickExportFile[] = [];
  if (documentA?.tree) {
    newickFiles.push({
      fileName: `${baseNameA}-A.nwk`,
      content: new PhyloTreeModel(documentA.tree).toNewick(),
    });
  }
  if (documentB?.tree) {
    newickFiles.push({
      fileName: `${baseNameB}-B.nwk`,
      content: new PhyloTreeModel(documentB.tree).toNewick(),
    });
  }
  return {
    visualBaseName: `${baseNameA}__${baseNameB}-tanglegram`,
    newickFiles,
  };
}

function getBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '') || fileName;
  return withoutExtension.replace(/[^A-Za-z0-9_-]+/g, '_') || 'tree';
}
