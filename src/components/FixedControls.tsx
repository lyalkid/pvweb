import { useEffect, useRef, useState, type RefObject } from 'react';
import { useI18n } from '../i18n/provider';
import type { AppMode, ViewerCommands } from '../hooks/useAppModel';
import { downloadTextFile } from '../utils/viewer-export';

export interface NewickExportFile {
  fileName: string;
  content: string;
}

interface FixedControlsProps {
  mode: AppMode;
  canRenderTree: boolean;
  canRenderTanglegram: boolean;
  isOptimizingTanglegram: boolean;
  canUndoTreeHistory: boolean;
  canRedoTreeHistory: boolean;
  onUndoTreeHistory: () => void | Promise<void>;
  onRedoTreeHistory: () => void | Promise<void>;
  onOptimizeTanglegram: () => void | Promise<void>;
  exportVisualBaseName: string;
  newickExportFiles: NewickExportFile[];
  viewerRef: RefObject<ViewerCommands | null>;
}

export function FixedControls({
  mode,
  canRenderTree,
  canRenderTanglegram,
  isOptimizingTanglegram,
  canUndoTreeHistory,
  canRedoTreeHistory,
  onUndoTreeHistory,
  onRedoTreeHistory,
  onOptimizeTanglegram,
  exportVisualBaseName,
  newickExportFiles,
  viewerRef,
}: FixedControlsProps) {
  const { t } = useI18n();
  const canRender = mode === 'tree' ? canRenderTree : canRenderTanglegram;
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!exportMenuOpen) {
      return;
    }
    const closeMenu = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [exportMenuOpen]);

  useEffect(() => {
    setExportMenuOpen(false);
    setExportError(false);
    setIsExporting(false);
  }, [mode, exportVisualBaseName]);

  function handleExportSvg() {
    setExportError(false);
    try {
      viewerRef.current?.exportSvg(`${exportVisualBaseName}.svg`);
      setExportMenuOpen(false);
    } catch {
      setExportError(true);
    }
  }

  async function handleExportPng() {
    setExportError(false);
    setIsExporting(true);
    try {
      await viewerRef.current?.exportPng(`${exportVisualBaseName}.png`);
      setExportMenuOpen(false);
    } catch {
      setExportError(true);
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportNewick() {
    setExportError(false);
    try {
      for (const file of newickExportFiles) {
        downloadTextFile(file.content, file.fileName);
      }
      setExportMenuOpen(false);
    } catch {
      setExportError(true);
    }
  }

  return (
    <>
      <div className="fixed-top-right">
        <button
          type="button"
          className="fixed-action"
          onClick={() => void onUndoTreeHistory()}
          disabled={mode !== 'tree' || !canUndoTreeHistory}
          title={t('fixed.undo')}
        >
          ↶
        </button>
        <button
          type="button"
          className="fixed-action"
          onClick={() => void onRedoTreeHistory()}
          disabled={mode !== 'tree' || !canRedoTreeHistory}
          title={t('fixed.redo')}
        >
          ↷
        </button>
        <div ref={exportMenuRef} className="fixed-export">
          <button
            type="button"
            className="fixed-action"
            onClick={() => setExportMenuOpen((current) => !current)}
            disabled={!canRender}
            title={canRender ? t('fixed.export') : t('fixed.exportUnavailable')}
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
          >
            ⤓
          </button>
          {exportMenuOpen ? (
            <div className="fixed-export-menu" role="menu">
              <button type="button" role="menuitem" onClick={handleExportSvg} disabled={isExporting}>
                {t('fixed.exportSvg')}
              </button>
              <button type="button" role="menuitem" onClick={() => void handleExportPng()} disabled={isExporting}>
                {t('fixed.exportPng')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleExportNewick}
                disabled={newickExportFiles.length === 0 || isExporting}
              >
                {newickExportFiles.length > 1 ? t('fixed.exportNewickPair') : t('fixed.exportNewick')}
              </button>
              {isExporting ? <p className="fixed-export-status">{t('fixed.exporting')}</p> : null}
              {exportError ? <p className="fixed-export-error">{t('fixed.exportError')}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="fixed-bottom-right">
        <button type="button" className="fixed-action" onClick={() => viewerRef.current?.zoomIn()} disabled={!canRender}>
          +
        </button>
        <button type="button" className="fixed-action" onClick={() => viewerRef.current?.zoomOut()} disabled={!canRender}>
          −
        </button>
        <button
          type="button"
          className="fixed-action"
          onClick={() => void onOptimizeTanglegram()}
          disabled={mode !== 'tanglegram' || !canRenderTanglegram || isOptimizingTanglegram}
          title={t('fixed.optimize')}
        >
          ◌
        </button>
        <button type="button" className="fixed-action" onClick={() => viewerRef.current?.resetView()} disabled={!canRender}>
          ⊡
        </button>
      </div>
    </>
  );
}
