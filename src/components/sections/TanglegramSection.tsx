import { useState } from 'react';
import { useI18n } from '../../i18n/provider';
import type {
  TanglegramOptimizeMode,
  TanglegramOptimizeRequestDto,
  TanglegramOptimizeResponseDto,
} from '../../lib/api';
import type { ViewerDocument } from '../../utils/viewer-document';
import { CollapsibleSection } from './CollapsibleSection';
import {
  buildTanglegramPairs,
  PhyloTreeModel,
  TanglegramState,
  ViewState,
  type TanglegramLabelDensityMode,
  type TanglegramRenderOptions,
  type TanglegramStateSnapshot,
  type ViewStateSnapshot,
} from 'phylo-tree-lib';

interface TanglegramSectionProps {
  documentA: ViewerDocument | null;
  documentB: ViewerDocument | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  options: TanglegramRenderOptions;
  selectedSide: 'A' | 'B' | null;
  selectedNodeId: string | null;
  matchedConnectionKey: string | null;
  actionMessage: string | null;
  optimizationStatus: 'idle' | 'running' | 'success' | 'error';
  optimizationResult: TanglegramOptimizeResponseDto | null;
  optimizationError: string | null;
  optimizationApplyStatus: 'idle' | 'applying' | 'applied' | 'restoring' | 'restored' | 'error';
  optimizationApplyError: string | null;
  stateSnapshot: TanglegramStateSnapshot | null;
  viewStateSnapshotA: ViewStateSnapshot | null;
  viewStateSnapshotB: ViewStateSnapshot | null;
  onToggleCollapseSelected: () => void;
  onSwapSelectedChildren: () => Promise<void>;
  onSetSelectedColor: (color: string) => void;
  onClearSelectedColor: () => void;
  onToggleSelectedConnection: () => void;
  onOptimize: (payload: TanglegramOptimizeRequestDto) => Promise<void>;
  onApplyOptimization: () => Promise<void>;
  onRestoreOriginals: () => Promise<void>;
  onUpdateOption: <K extends keyof TanglegramRenderOptions>(
    key: K,
    value: TanglegramRenderOptions[K]
  ) => void;
}

export function TanglegramSection({
  documentA,
  documentB,
  saveStatus,
  options,
  selectedSide,
  selectedNodeId,
  matchedConnectionKey,
  actionMessage,
  optimizationStatus,
  optimizationResult,
  optimizationError,
  optimizationApplyStatus,
  optimizationApplyError,
  stateSnapshot,
  viewStateSnapshotA,
  viewStateSnapshotB,
  onToggleCollapseSelected,
  onSwapSelectedChildren,
  onSetSelectedColor,
  onClearSelectedColor,
  onToggleSelectedConnection,
  onOptimize,
  onApplyOptimization,
  onRestoreOriginals,
  onUpdateOption,
}: TanglegramSectionProps) {
  const { t } = useI18n();
  const overlap = getTanglegramOverlap(documentA, documentB, t);
  const selectedInfo = getSelectedTanglegramInfo(
    documentA,
    documentB,
    stateSnapshot,
    viewStateSnapshotA,
    viewStateSnapshotB,
    selectedSide,
    selectedNodeId,
    matchedConnectionKey,
    t
  );

  return (
    <>
      <OptimizationPanel
        canOptimize={Boolean(documentA?.tree && documentB?.tree)}
        status={optimizationStatus}
        result={optimizationResult}
        error={optimizationError}
        applyStatus={optimizationApplyStatus}
        applyError={optimizationApplyError}
        onOptimize={onOptimize}
        onApply={onApplyOptimization}
        onRestoreOriginals={onRestoreOriginals}
      />
      <CollapsibleSection title={t('tanglegram.selectedNodeTitle')} defaultExpanded>
        {!selectedInfo ? <div className="hint">{t('tanglegram.chooseNode')}</div> : null}
        {selectedInfo ? (
          <>
            <div className="metrics-list">
              <div className="metrics-row">
                <span>{t('tanglegram.side')}</span>
                <span>{selectedInfo.side}</span>
              </div>
              <div className="metrics-row">
                <span>{t('tanglegram.node')}</span>
                <span>{selectedInfo.nodeLabel}</span>
              </div>
              <div className="metrics-row">
                <span>{t('tanglegram.collapsed')}</span>
                <span>{selectedInfo.collapsedLabel}</span>
              </div>
              <div className="metrics-row">
                <span>{t('tanglegram.connection')}</span>
                <span>{selectedInfo.connectionLabel}</span>
              </div>
              <div className="metrics-row">
                <span>{t('tanglegram.connectionState')}</span>
                <span>{selectedInfo.connectionKey ? (selectedInfo.connectionHidden ? t('tanglegram.hidden') : t('tanglegram.visible')) : t('projectFiles.notAvailable')}</span>
              </div>
              <div className="metrics-row">
                <span>{t('tanglegram.color')}</span>
                <span>{selectedInfo.colorLabel}</span>
              </div>
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={onToggleCollapseSelected}
                disabled={!selectedInfo.treeSideViewActionsReady}
              >
                {t('tanglegram.collapseExpand')}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void onSwapSelectedChildren()}
                disabled={!selectedInfo.canSwapChildren}
              >
                {t('tanglegram.swapChildren')}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => onSetSelectedColor('#c0392b')}
                disabled={!selectedInfo.treeSideViewActionsReady}
              >
                {t('tanglegram.colorRed')}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={onClearSelectedColor}
                disabled={!selectedInfo.treeSideViewActionsReady}
              >
                {t('tanglegram.clearColor')}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={onToggleSelectedConnection}
                disabled={!selectedInfo.connectionKey}
              >
                {selectedInfo.connectionHidden ? t('tanglegram.showConnection') : t('tanglegram.hideConnection')}
              </button>
            </div>
          </>
        ) : null}
        {actionMessage ? <div className="hint">{actionMessage}</div> : null}
      </CollapsibleSection>
      {overlap ? (
        <CollapsibleSection title={t('tanglegram.matchingTitle')} defaultExpanded>
          <div className="metrics-list">
            <div className="metrics-row">
              <span>{t('tanglegram.matchedLeaves')}</span>
              <span>{overlap.matchedLeaves}</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.onlyA')}</span>
              <span>{overlap.onlyA}</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.onlyB')}</span>
              <span>{overlap.onlyB}</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.status')}</span>
              <span>{overlap.statusLabel}</span>
            </div>
          </div>
          {overlap.message ? <div className="hint">{overlap.message}</div> : null}
        </CollapsibleSection>
      ) : null}
      <TreeInputCard
        title={t('tanglegram.treeA')}
        document={documentA}
        saveStatus={saveStatus}
        options={{
          showLabels: options.showLabelsA,
          alignTips: options.alignTipsA,
          useBranchLengths: options.useBranchLengthsA,
          labelDensity: options.labelDensityA,
          layoutSpacingX: options.layoutSpacingXA,
          layoutSpacingY: options.layoutSpacingYA,
        }}
        labels={{
          showLabels: t('tanglegramSettings.labelsA'),
          alignTips: t('tanglegramSettings.alignTipsA'),
          branchLengths: t('tanglegramSettings.branchLengthsA'),
          labelDensity: t('tanglegramSettings.labelDensityA'),
          spacingX: t('tanglegramSettings.spacingXA'),
          spacingY: t('tanglegramSettings.spacingYA'),
        }}
        onUpdate={{
          showLabels: (value) => onUpdateOption('showLabelsA', value),
          alignTips: (value) => onUpdateOption('alignTipsA', value),
          useBranchLengths: (value) => onUpdateOption('useBranchLengthsA', value),
          labelDensity: (value) => onUpdateOption('labelDensityA', value),
          layoutSpacingX: (value) => onUpdateOption('layoutSpacingXA', value),
          layoutSpacingY: (value) => onUpdateOption('layoutSpacingYA', value),
        }}
      />
      <TreeInputCard
        title={t('tanglegram.treeB')}
        document={documentB}
        saveStatus={saveStatus}
        options={{
          showLabels: options.showLabelsB,
          alignTips: options.alignTipsB,
          useBranchLengths: options.useBranchLengthsB,
          labelDensity: options.labelDensityB,
          layoutSpacingX: options.layoutSpacingXB,
          layoutSpacingY: options.layoutSpacingYB,
        }}
        labels={{
          showLabels: t('tanglegramSettings.labelsB'),
          alignTips: t('tanglegramSettings.alignTipsB'),
          branchLengths: t('tanglegramSettings.branchLengthsB'),
          labelDensity: t('tanglegramSettings.labelDensityB'),
          spacingX: t('tanglegramSettings.spacingXB'),
          spacingY: t('tanglegramSettings.spacingYB'),
        }}
        onUpdate={{
          showLabels: (value) => onUpdateOption('showLabelsB', value),
          alignTips: (value) => onUpdateOption('alignTipsB', value),
          useBranchLengths: (value) => onUpdateOption('useBranchLengthsB', value),
          labelDensity: (value) => onUpdateOption('labelDensityB', value),
          layoutSpacingX: (value) => onUpdateOption('layoutSpacingXB', value),
          layoutSpacingY: (value) => onUpdateOption('layoutSpacingYB', value),
        }}
      />
    </>
  );
}

function OptimizationPanel({
  canOptimize,
  status,
  result,
  error,
  applyStatus,
  applyError,
  onOptimize,
  onApply,
  onRestoreOriginals,
}: {
  canOptimize: boolean;
  status: 'idle' | 'running' | 'success' | 'error';
  result: TanglegramOptimizeResponseDto | null;
  error: string | null;
  applyStatus: 'idle' | 'applying' | 'applied' | 'restoring' | 'restored' | 'error';
  applyError: string | null;
  onOptimize: (payload: TanglegramOptimizeRequestDto) => Promise<void>;
  onApply: () => Promise<void>;
  onRestoreOriginals: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<TanglegramOptimizeMode>('auto');
  const isRunning = status === 'running';
  const isPersisting = applyStatus === 'applying' || applyStatus === 'restoring';

  return (
    <CollapsibleSection title={t('tanglegram.optimizeTitle')} defaultExpanded>
      <div className="settings-row">
        <span>{t('tanglegram.optimizeMode')}</span>
        <select
          value={mode}
          disabled={isRunning || isPersisting}
          onChange={(event) => setMode(event.target.value as TanglegramOptimizeMode)}
        >
          {(['auto', 'greedy'] as const).map((value) => (
            <option key={value} value={value}>{formatOptimizationMode(value, t)}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="action-button action-button-primary"
        disabled={!canOptimize || isRunning || isPersisting}
        onClick={() => void onOptimize({ mode })}
      >
        {isRunning ? t('tanglegram.optimizing') : t('tanglegram.optimize')}
      </button>
      {!canOptimize ? <div className="hint">{t('tanglegram.optimizeRequiresPair')}</div> : null}
      {error ? <div className="error">{error}</div> : null}
      {result ? (
        <>
          <div className="metrics-list">
            <div className="metrics-row">
              <span>{t('tanglegram.optimizeRequestedMode')}</span>
              <span>{formatOptimizationMode(result.requestedMode, t)}</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.optimizeEffectiveMethod')}</span>
              <span>{formatOptimizationMode(result.effectiveMode, t)}</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.optimizeLeaves')}</span>
              <span>{result.nLeaves}</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.optimizeMatchedLeaves')}</span>
              <span>{result.matchedLeafCount}</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.optimizeBefore')}</span>
              <span>{result.initialCrossings}</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.optimizeAfter')}</span>
              <span>{result.finalCrossings}</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.optimizeImprovement')}</span>
              <span>{(result.relativeImprovement * 100).toFixed(1)}%</span>
            </div>
            <div className="metrics-row">
              <span>{t('tanglegram.optimizeRuntime')}</span>
              <span>{result.runtimeSec.toFixed(2)} s</span>
            </div>
          </div>
          {result.warnings.map((warning) => (
            <div className="hint" key={warning}>{warning}</div>
          ))}
        </>
      ) : null}
      <div className="inline-actions">
        {result ? (
          <button
            type="button"
            className="action-button action-button-primary"
            disabled={isRunning || isPersisting}
            onClick={() => void onApply()}
          >
            {applyStatus === 'applying' ? t('tanglegram.applyingOptimization') : t('tanglegram.applyOptimization')}
          </button>
        ) : null}
        <button
          type="button"
          className="action-button action-button-secondary"
          disabled={!canOptimize || isRunning || isPersisting}
          onClick={() => void onRestoreOriginals()}
        >
          {applyStatus === 'restoring' ? t('tanglegram.restoringOriginals') : t('tanglegram.restoreOriginals')}
        </button>
      </div>
      {applyStatus === 'applied' ? <div className="hint">{t('tanglegram.optimizationApplied')}</div> : null}
      {applyStatus === 'restored' ? <div className="hint">{t('tanglegram.originalsRestored')}</div> : null}
      {applyError ? <div className="error">{applyError}</div> : null}
    </CollapsibleSection>
  );
}

function formatOptimizationMode(
  mode: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  switch (mode) {
    case 'auto':
      return t('tanglegram.modeAuto');
    case 'greedy':
      return t('tanglegram.modeGreedy');
    case 'greedy_fallback':
      return t('tanglegram.modeGreedyFallback');
    default:
      return mode;
  }
}

function getSelectedTanglegramInfo(
  documentA: ViewerDocument | null,
  documentB: ViewerDocument | null,
  stateSnapshot: TanglegramStateSnapshot | null,
  viewStateSnapshotA: ViewStateSnapshot | null,
  viewStateSnapshotB: ViewStateSnapshot | null,
  selectedSide: 'A' | 'B' | null,
  selectedNodeId: string | null,
  matchedConnectionKey: string | null,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!selectedSide || !selectedNodeId) {
    return null;
  }

  const state = TanglegramState.fromJSON(stateSnapshot);
  const tree = selectedSide === 'A' ? documentA?.tree ?? null : documentB?.tree ?? null;
  const sideViewState = ViewState.fromJSON(selectedSide === 'A' ? viewStateSnapshotA : viewStateSnapshotB);
  const node = tree ? new PhyloTreeModel(tree).findById(selectedNodeId) : null;

  return {
    side: selectedSide,
    nodeLabel: node?.name || selectedNodeId,
    treeSideViewActionsReady: true,
    canSwapChildren: Boolean(node && node.children.length >= 2),
    collapsedLabel: sideViewState.isCollapsed(selectedNodeId) ? t('common.yes') : t('common.no'),
    colorLabel: sideViewState.getColor(selectedNodeId) ?? t('tanglegram.inheritedColor'),
    connectionKey: matchedConnectionKey,
    connectionHidden: matchedConnectionKey ? state.isConnectionHidden(matchedConnectionKey) : false,
    connectionLabel: matchedConnectionKey ?? t('tanglegram.noConnection'),
  };
}

function TreeInputCard({
  title,
  document,
  saveStatus,
  options,
  labels,
  onUpdate,
}: {
  title: string;
  document: ViewerDocument | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  options: {
    showLabels: boolean;
    alignTips: boolean;
    useBranchLengths: boolean;
    labelDensity: TanglegramLabelDensityMode;
    layoutSpacingX: number;
    layoutSpacingY: number;
  };
  labels: {
    showLabels: string;
    alignTips: string;
    branchLengths: string;
    labelDensity: string;
    spacingX: string;
    spacingY: string;
  };
  onUpdate: {
    showLabels: (value: boolean) => void;
    alignTips: (value: boolean) => void;
    useBranchLengths: (value: boolean) => void;
    labelDensity: (value: TanglegramLabelDensityMode) => void;
    layoutSpacingX: (value: number) => void;
    layoutSpacingY: (value: number) => void;
  };
}) {
  const { t } = useI18n();

  return (
    <CollapsibleSection title={title} defaultExpanded>
      {!document ? <div className="hint">{t('tanglegram.chooseFileForSide', { side: title })}</div> : null}
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
            <span>{t('tanglegram.save')}</span>
            <span>{formatSaveStatus(saveStatus, t)}</span>
          </div>
        </div>
      ) : null}
      <div className="control-section-subgroup">
        <ToggleRow
          label={labels.showLabels}
          isActive={options.showLabels}
          onToggle={() => onUpdate.showLabels(!options.showLabels)}
        />
        <ToggleRow
          label={labels.alignTips}
          isActive={options.alignTips}
          onToggle={() => onUpdate.alignTips(!options.alignTips)}
        />
        <ToggleRow
          label={labels.branchLengths}
          isActive={options.useBranchLengths}
          onToggle={() => onUpdate.useBranchLengths(!options.useBranchLengths)}
        />
        <SelectRow
          label={labels.labelDensity}
          value={options.labelDensity}
          options={[
            ['all', t('tanglegramSettings.densityAll')],
            ['auto', t('tanglegramSettings.densityAuto')],
            ['sparse', t('tanglegramSettings.densitySparse')],
          ]}
          onChange={onUpdate.labelDensity}
        />
        <RangeRow
          label={labels.spacingX}
          min={0.5}
          max={3}
          step={0.1}
          value={options.layoutSpacingX}
          onCommit={onUpdate.layoutSpacingX}
        />
        <RangeRow
          label={labels.spacingY}
          min={0.5}
          max={3}
          step={0.1}
          value={options.layoutSpacingY}
          onCommit={onUpdate.layoutSpacingY}
        />
      </div>
    </CollapsibleSection>
  );
}

function ToggleRow({
  label,
  isActive,
  onToggle,
}: {
  label: string;
  isActive: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="settings-toggle">
      <span>{label}</span>
      <button
        type="button"
        className={`settings-toggle-button${isActive ? ' settings-toggle-button-active' : ''}`}
        onClick={onToggle}
      >
        {isActive ? t('common.on') : t('common.off')}
      </button>
    </div>
  );
}

function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="control-row">
      <label className="label">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function RangeRow({
  label,
  min,
  max,
  step,
  value,
  onCommit,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="control-row control-row-range">
      <label className="label">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onCommit(Number(event.target.value))}
      />
      <span>{value.toFixed(1)}</span>
    </div>
  );
}

function formatSaveStatus(
  saveStatus: TanglegramSectionProps['saveStatus'],
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

function getTanglegramOverlap(
  documentA: ViewerDocument | null,
  documentB: ViewerDocument | null,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!documentA?.tree || !documentB?.tree) {
    return null;
  }

  const pairs = buildTanglegramPairs(documentA.tree, documentB.tree);
  const leavesA = new PhyloTreeModel(documentA.tree).leaves().filter((node) => Boolean(node.name));
  const leavesB = new PhyloTreeModel(documentB.tree).leaves().filter((node) => Boolean(node.name));
  const matchedLeaves = pairs.length;
  const onlyA = Math.max(0, leavesA.length - matchedLeaves);
  const onlyB = Math.max(0, leavesB.length - matchedLeaves);

  if (matchedLeaves === 0) {
    return {
      matchedLeaves,
      onlyA,
      onlyB,
      statusLabel: t('tanglegram.noOverlap'),
      message: t('tanglegram.noOverlapMessage'),
    };
  }

  if (onlyA > 0 || onlyB > 0) {
    return {
      matchedLeaves,
      onlyA,
      onlyB,
      statusLabel: t('tanglegram.partialOverlap'),
      message: t('tanglegram.partialOverlapMessage'),
    };
  }

  return {
    matchedLeaves,
    onlyA,
    onlyB,
    statusLabel: t('tanglegram.fullOverlap'),
    message: t('tanglegram.fullOverlapMessage'),
  };
}
