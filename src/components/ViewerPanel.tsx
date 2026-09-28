import type { RefObject } from 'react';
import type { AppModel, ViewerCommands } from '../hooks/useAppModel';
import type { ViewerWorkspace } from '../hooks/useWorkspaceController';
import { CanvasTreeNavigator } from './CanvasTreeNavigator';
import { SingleTreeViewer } from './viewers/SingleTreeViewer';
import { TanglegramViewer } from './viewers/TanglegramViewer';

interface ViewerPanelProps {
  model: AppModel;
  viewerRef: RefObject<ViewerCommands | null>;
  workspace: ViewerWorkspace;
}

export function ViewerPanel({ model, viewerRef, workspace }: ViewerPanelProps) {
  return (
    <section className="viewer-panel">
      <CanvasTreeNavigator
        mode={model.layout.mode}
        files={workspace.project.files}
        activeTreeFileId={workspace.activeTreeFileId}
        activeFileIdA={workspace.activeFileIdA}
        activeFileIdB={workspace.activeFileIdB}
        onOpenTree={workspace.onOpenTree}
        onLoadToA={workspace.onLoadToA}
        onLoadToB={workspace.onLoadToB}
      />
      {model.layout.mode === 'tree' ? (
        <SingleTreeViewer
          ref={viewerRef}
          document={workspace.singleDocument}
          viewStateSnapshot={workspace.singleViewStateSnapshot}
          selectedNodeId={workspace.singleSelectedNodeId}
          onSelectedNodeChange={workspace.onSingleSelectedNodeChange}
          onToggleCollapseSelected={workspace.onToggleCollapseSelected}
          onSetSelectedColor={workspace.onSetSelectedColor}
          onClearSelectedColor={workspace.onClearSelectedColor}
          onExpandAll={workspace.onExpandAllSingle}
          onRerootSelected={workspace.onRerootSelected}
          onSwapSelectedChildren={workspace.onSwapSelectedChildren}
          onPruneSelected={workspace.onPruneSelected}
          onLadderize={workspace.onLadderizeSingle}
          options={model.settings.tree}
          theme={model.layout.theme}
        />
      ) : (
        <TanglegramViewer
          ref={viewerRef}
          documentA={workspace.documentA}
          documentB={workspace.documentB}
          stateSnapshot={workspace.tanglegramStateSnapshot}
          viewStateSnapshotA={workspace.tanglegramViewStateASnapshot}
          viewStateSnapshotB={workspace.tanglegramViewStateBSnapshot}
          onSelectedNodeChange={workspace.onTanglegramSelectedNodeChange}
          onFocusedConnectionChange={workspace.onFocusedTanglegramConnectionChange}
          options={model.settings.tanglegram}
          theme={model.layout.theme}
        />
      )}
    </section>
  );
}
