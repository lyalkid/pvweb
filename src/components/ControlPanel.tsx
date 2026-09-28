import type { AppModel } from '../hooks/useAppModel';
import type { ControlPanelWorkspace } from '../hooks/useWorkspaceController';
import { ProjectFilesSection } from './ProjectFilesSection';
import { CommonSettingsSection } from './sections/CommonSettingsSection';
import { SingleTreeSection } from './sections/SingleTreeSection';
import { TanglegramSection } from './sections/TanglegramSection';
import { TanglegramSettingsSection } from './sections/TanglegramSettingsSection';
import { TreeSettingsSection } from './sections/TreeSettingsSection';

interface ControlPanelProps {
  model: AppModel;
  workspace: ControlPanelWorkspace;
}

export function ControlPanel({ model, workspace }: ControlPanelProps) {
  return (
    <section className={`control-panel${model.layout.menuOpen ? '' : ' collapsed'}`}>
      <div className="control-panel-stack">
        <ProjectFilesSection
          model={model}
          project={workspace.project}
          activeTreeFileId={workspace.activeTreeFileId}
          activeFileIdA={workspace.activeFileIdA}
          activeFileIdB={workspace.activeFileIdB}
          error={workspace.error}
          onOpenTree={workspace.onOpenTree}
          onLoadToA={workspace.onLoadToA}
          onLoadToB={workspace.onLoadToB}
        />
        {model.layout.mode === 'tree' ? (
          <SingleTreeSection
            document={workspace.singleDocument}
            saveStatus={workspace.singleSaveStatus}
            contentSaveStatus={workspace.contentSaveStatus}
            selectedNodeId={workspace.singleSelectedNodeId}
            viewStateSnapshot={workspace.singleViewStateSnapshot}
            editorText={workspace.editorText}
            originalText={workspace.originalText}
            actionMessage={workspace.singleActionMessage}
            editorParseError={workspace.editorParseError}
            onEditorTextChange={workspace.onEditorTextChange}
            onToggleCollapseSelected={workspace.onToggleCollapseSelected}
            onSetSelectedColor={workspace.onSetSelectedColor}
            onClearSelectedColor={workspace.onClearSelectedColor}
            onExpandAll={workspace.onExpandAllSingle}
            onRerootSelected={workspace.onRerootSelected}
            onSwapSelectedChildren={workspace.onSwapSelectedChildren}
            onPruneSelected={workspace.onPruneSelected}
            onLadderize={workspace.onLadderizeSingle}
            onRenderEditorText={workspace.onRenderEditorText}
            onSaveEditorText={workspace.onSaveEditorText}
            onRestoreOriginalText={workspace.onRestoreOriginalText}
          />
        ) : null}
        {model.layout.mode === 'tree' ? (
          <TreeSettingsSection
            options={model.settings.tree}
            onUpdate={model.settings.updateTree}
          />
        ) : null}
        {model.layout.mode === 'tree' ? (
          <CommonSettingsSection
            isTree
            current={model.settings.tree}
            onUpdate={(key, value) => model.settings.updateTree(key as never, value as never)}
          />
        ) : null}

        {model.layout.mode === 'tanglegram' ? (
          <TanglegramSection
            documentA={workspace.documentA}
            documentB={workspace.documentB}
            saveStatus={workspace.tanglegramSaveStatus}
            options={model.settings.tanglegram}
            selectedSide={workspace.tanglegramSelectedSide}
            selectedNodeId={workspace.tanglegramSelectedNodeId}
            matchedConnectionKey={workspace.tanglegramMatchedConnectionKey}
            actionMessage={workspace.tanglegramActionMessage}
            optimizationStatus={workspace.tanglegramOptimizationStatus}
            optimizationResult={workspace.tanglegramOptimizationResult}
            optimizationError={workspace.tanglegramOptimizationError}
            optimizationApplyStatus={workspace.tanglegramOptimizationApplyStatus}
            optimizationApplyError={workspace.tanglegramOptimizationApplyError}
            stateSnapshot={workspace.tanglegramStateSnapshot}
            viewStateSnapshotA={workspace.tanglegramViewStateASnapshot}
            viewStateSnapshotB={workspace.tanglegramViewStateBSnapshot}
            onToggleCollapseSelected={workspace.onToggleCollapseSelectedTanglegram}
            onSwapSelectedChildren={workspace.onSwapSelectedChildrenTanglegram}
            onSetSelectedColor={workspace.onSetSelectedColorTanglegram}
            onClearSelectedColor={workspace.onClearSelectedColorTanglegram}
            onToggleSelectedConnection={workspace.onToggleSelectedConnection}
            onOptimize={workspace.onOptimizeTanglegram}
            onApplyOptimization={workspace.onApplyTanglegramOptimization}
            onRestoreOriginals={workspace.onRestoreOriginalTanglegram}
            onUpdateOption={model.settings.updateTanglegram}
          />
        ) : null}
        {model.layout.mode === 'tanglegram' ? (
          <TanglegramSettingsSection
            options={model.settings.tanglegram}
            onUpdate={model.settings.updateTanglegram}
          />
        ) : null}
        {model.layout.mode === 'tanglegram' ? (
          <CommonSettingsSection
            isTree={false}
            current={model.settings.tanglegram}
            onUpdate={(key, value) => model.settings.updateTanglegram(key as never, value as never)}
          />
        ) : null}
      </div>
    </section>
  );
}
