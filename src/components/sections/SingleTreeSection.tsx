import { useI18n } from '../../i18n/provider';
import type { ViewerDocument } from '../../utils/viewer-document';
import { CollapsibleSection } from './CollapsibleSection';
import { PhyloTreeModel, type ViewStateSnapshot } from 'phylo-tree-lib';

interface SingleTreeSectionProps {
  document: ViewerDocument | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  contentSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  selectedNodeId: string | null;
  viewStateSnapshot: ViewStateSnapshot | null;
  editorText: string;
  originalText: string;
  editorParseError: string | null;
  actionMessage: string | null;
  onEditorTextChange: (text: string) => void;
  onToggleCollapseSelected: () => void;
  onSetSelectedColor: (color: string) => void;
  onClearSelectedColor: () => void;
  onExpandAll: () => void;
  onRerootSelected: () => Promise<void>;
  onSwapSelectedChildren: () => Promise<void>;
  onPruneSelected: () => Promise<void>;
  onLadderize: (direction: 'ascending' | 'descending') => Promise<void>;
  onRenderEditorText: () => Promise<void>;
  onSaveEditorText: () => Promise<void>;
  onRestoreOriginalText: () => Promise<void>;
}

export function SingleTreeSection({
  document,
  saveStatus,
  contentSaveStatus,
  selectedNodeId,
  viewStateSnapshot,
  editorText,
  originalText,
  editorParseError,
  actionMessage,
  onEditorTextChange,
  onToggleCollapseSelected,
  onSetSelectedColor,
  onClearSelectedColor,
  onExpandAll,
  onRerootSelected,
  onSwapSelectedChildren,
  onPruneSelected,
  onLadderize,
  onRenderEditorText,
  onSaveEditorText,
  onRestoreOriginalText,
}: SingleTreeSectionProps) {
  const { t } = useI18n();
  const currentRenderedText = document?.rawText ?? '';
  const hasEditorText = editorText.trim().length > 0;
  const hasDraftChanges = editorText !== currentRenderedText;
  const differsFromOriginal = Boolean(originalText) && currentRenderedText !== originalText;
  const canRenderEditor = hasEditorText && hasDraftChanges && !editorParseError;
  const canSaveFile = hasEditorText && (editorText !== originalText || differsFromOriginal) && !editorParseError;
  const canRestoreOriginal = Boolean(originalText) && (editorText !== originalText || differsFromOriginal);
  const isSelectedCollapsed = selectedNodeId
    ? (viewStateSnapshot?.collapsed ?? []).includes(selectedNodeId)
    : false;
  const selectedNodeColor =
    selectedNodeId == null
      ? '#1f6aa5'
      : (viewStateSnapshot?.clusterColors ?? []).find(([nodeId]) => nodeId === selectedNodeId)?.[1] ?? '#1f6aa5';
  const selectedNode = document?.tree && selectedNodeId
    ? new PhyloTreeModel(document.tree).findById(selectedNodeId)
    : null;
  const canSwapSelected = Boolean(selectedNode && selectedNode.children.length >= 2);
  const canPruneSelected = Boolean(selectedNodeId && document?.tree && document.tree.root.id !== selectedNodeId);

  return (
    <CollapsibleSection title={t('singleTree.title')} defaultExpanded>
      {!document ? <div className="hint">{t('singleTree.chooseFile')}</div> : null}
      {document?.error ? <div className="error">{document.error}</div> : null}
      {document?.warning ? <div className="hint">{document.warning}</div> : null}
      {document?.stats ? (
        <div className="metrics-list">
          <div className="metrics-row">
            <span>{t('singleTree.leaves')}</span>
            <span>{document.stats.leaves}</span>
          </div>
          <div className="metrics-row">
            <span>{t('singleTree.nodes')}</span>
            <span>{document.stats.nodes}</span>
          </div>
          <div className="metrics-row">
            <span>{t('singleTree.selectedNode')}</span>
            <span>{selectedNodeId ?? t('singleTree.noSelection')}</span>
          </div>
        </div>
      ) : null}
      {actionMessage ? <div className="hint">{actionMessage}</div> : null}
      {editorParseError ? <div className="error">{editorParseError}</div> : null}
      {document ? (
        <div className="state-stack">
          <div className="state-card">
            <span className="state-card-label">{t('singleTree.viewState')}</span>
            <span className="state-card-value">{formatSaveStatus(saveStatus, t)}</span>
          </div>
          {contentSaveStatus !== 'idle' ? (
            <div className="state-card">
              <span className="state-card-label">{t('singleTree.fileContent')}</span>
              <span className="state-card-value">{formatSaveStatus(contentSaveStatus, t)}</span>
            </div>
          ) : null}
          {hasDraftChanges ? (
            <div className="state-card state-card-warning">
              <span className="state-card-label">{t('singleTree.editor')}</span>
              <span className="state-card-value">{t('singleTree.editorDiffers')}</span>
            </div>
          ) : null}
          {differsFromOriginal ? (
            <div className="state-card state-card-warning">
              <span className="state-card-label">{t('singleTree.document')}</span>
              <span className="state-card-value">{t('singleTree.documentDiffers')}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {document?.tree ? (
        <div className="control-section-subgroup">
          <div className="project-file-actions">
            <button type="button" onClick={onToggleCollapseSelected} disabled={!selectedNodeId}>
              {isSelectedCollapsed ? t('singleTree.expandSelected') : t('singleTree.collapseSelected')}
            </button>
            <button type="button" onClick={onExpandAll} disabled={!viewStateSnapshot?.collapsed.length}>
              {t('singleTree.expandAll')}
            </button>
          </div>
          <div className="project-file-actions">
            <button type="button" onClick={() => void onRerootSelected()} disabled={!selectedNodeId}>
              {t('singleTree.reroot')}
            </button>
            <button type="button" onClick={() => void onSwapSelectedChildren()} disabled={!canSwapSelected}>
              {t('singleTree.swapChildren')}
            </button>
          </div>
          <div className="project-file-actions">
            <button type="button" onClick={() => void onPruneSelected()} disabled={!canPruneSelected}>
              {t('singleTree.pruneSubtree')}
            </button>
            <button type="button" onClick={() => void onLadderize('ascending')}>
              {t('singleTree.ladderizeAsc')}
            </button>
            <button type="button" onClick={() => void onLadderize('descending')}>
              {t('singleTree.ladderizeDesc')}
            </button>
          </div>
          <div className="control-row">
            <label className="label">{t('singleTree.selectedNodeColor')}</label>
            <input
              type="color"
              value={selectedNodeColor}
              disabled={!selectedNodeId}
              onChange={(event) => onSetSelectedColor(event.target.value)}
            />
          </div>
          <div className="project-file-actions">
            <button type="button" onClick={onClearSelectedColor} disabled={!selectedNodeId}>
              {t('singleTree.clearSelectedColor')}
            </button>
          </div>
        </div>
      ) : null}

      {document ? (
        <div className="control-section-subgroup">
          <label className="label" htmlFor="tree-editor-textarea">{t('singleTree.treeText')}</label>
          <textarea
            id="tree-editor-textarea"
            className="newick-input"
            rows={10}
            value={editorText}
            onChange={(event) => onEditorTextChange(event.target.value)}
            placeholder={t('singleTree.treeTextPlaceholder')}
          />
          <div className="project-file-actions">
            <button type="button" onClick={() => void onRenderEditorText()} disabled={!canRenderEditor}>
              {t('common.render')}
            </button>
            <button type="button" onClick={() => void onSaveEditorText()} disabled={!canSaveFile}>
              {t('common.saveFile')}
            </button>
            <button
              type="button"
              onClick={() => void onRestoreOriginalText()}
              disabled={!canRestoreOriginal}
            >
              {t('common.restoreOriginal')}
            </button>
          </div>
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

function formatSaveStatus(
  saveStatus: SingleTreeSectionProps['saveStatus'],
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  switch (saveStatus) {
    case 'saving':
      return t('singleTree.statusSaving');
    case 'saved':
      return t('singleTree.statusSaved');
    case 'error':
      return t('singleTree.statusError');
    default:
      return t('singleTree.statusIdle');
  }
}
