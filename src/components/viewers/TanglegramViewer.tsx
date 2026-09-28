import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useI18n } from '../../i18n/provider';
import {
  buildTanglegramModel,
  renderTanglegramSvg,
  TanglegramViewportController,
  TanglegramState,
  ViewState,
  type TanglegramStateSnapshot,
  type TanglegramRenderOptions,
  type ViewStateSnapshot,
} from 'phylo-tree-lib';
import type { AppTheme, ViewerCommands } from '../../hooks/useAppModel';
import type { ViewerDocument } from '../../utils/viewer-document';
import { exportPngElement, exportSvgElement } from '../../utils/viewer-export';

interface TanglegramViewerProps {
  documentA: ViewerDocument | null;
  documentB: ViewerDocument | null;
  stateSnapshot: TanglegramStateSnapshot | null;
  viewStateSnapshotA: ViewStateSnapshot | null;
  viewStateSnapshotB: ViewStateSnapshot | null;
  onSelectedNodeChange: (side: 'A' | 'B' | null, nodeId: string | null) => void;
  onFocusedConnectionChange: (connectionKey: string) => void;
  options: TanglegramRenderOptions;
  theme: AppTheme;
}

export const TanglegramViewer = forwardRef<ViewerCommands, TanglegramViewerProps>(
  function TanglegramViewer({
    documentA,
    documentB,
    stateSnapshot,
    viewStateSnapshotA,
    viewStateSnapshotB,
    onSelectedNodeChange,
    onFocusedConnectionChange,
    options,
    theme,
  }, ref) {
    const { t } = useI18n();
    const svgRef = useRef<SVGSVGElement | null>(null);
    const viewportRef = useRef<TanglegramViewportController | null>(null);
    const renderedTreesRef = useRef<{ treeA: ViewerDocument['tree'] | null; treeB: ViewerDocument['tree'] | null }>({
      treeA: null,
      treeB: null,
    });
    const [renderError, setRenderError] = useState<string | null>(null);

    function renderScene() {
      if (!svgRef.current) {
        return null;
      }
      const treeA = documentA?.tree ?? null;
      const treeB = documentB?.tree ?? null;
      if (!treeA || !treeB) {
        svgRef.current.innerHTML = '';
        svgRef.current.setAttribute('viewBox', `0 0 ${options.width} ${options.height}`);
        return null;
      }

      const compareState = TanglegramState.fromJSON(stateSnapshot);
      const viewStateA = ViewState.fromJSON(viewStateSnapshotA);
      const viewStateB = ViewState.fromJSON(viewStateSnapshotB);
      const model = buildTanglegramModel({ treeA, treeB, options, viewStateA, viewStateB });
      const scene = renderTanglegramSvg(svgRef.current, {
        layout: model.layout,
        state: compareState,
        viewStateA,
        viewStateB,
        options,
        onNodeClick: ({ side, nodeId }) => {
          onSelectedNodeChange(side, nodeId);
        },
        onConnectionClick: ({ connectionKey }) => {
          onFocusedConnectionChange(connectionKey);
        },
      });

      const previousTransform = viewportRef.current?.getTransform() ?? null;
      viewportRef.current?.destroy();
      viewportRef.current = new TanglegramViewportController(
        svgRef.current,
        scene.rootLayer,
        {},
        {
          onBackgroundClick: () => {
            onSelectedNodeChange(null, null);
          },
        }
      );
      if (previousTransform) {
        viewportRef.current.setTransform(previousTransform);
      }

      renderedTreesRef.current = { treeA, treeB };
      return scene;
    }

    useImperativeHandle(ref, () => ({
      zoomIn() {
        zoomBy(1.2);
      },
      zoomOut() {
        zoomBy(1 / 1.2);
      },
      resetView() {
        viewportRef.current?.resetView();
      },
      exportSvg(fileName: string) {
        if (svgRef.current) {
          exportSvgElement(svgRef.current, fileName, theme === 'dark' ? '#1c1c1c' : '#ffffff');
        }
      },
      async exportPng(fileName: string) {
        if (svgRef.current) {
          await exportPngElement(svgRef.current, fileName, theme === 'dark' ? '#1c1c1c' : '#ffffff');
        }
      },
    }));

    useEffect(() => () => {
      viewportRef.current?.destroy();
      viewportRef.current = null;
    }, []);

    useEffect(() => {
      setRenderError(null);
      const treeA = documentA?.tree ?? null;
      const treeB = documentB?.tree ?? null;
      if (!treeA || !treeB) {
        renderedTreesRef.current = { treeA: null, treeB: null };
        return;
      }
      try {
        renderScene();
      } catch (error) {
        viewportRef.current?.destroy();
        viewportRef.current = null;
        renderedTreesRef.current = { treeA: null, treeB: null };
        setRenderError(error instanceof Error ? error.message : t('viewer.errorRenderTanglegram'));
      }
    }, [documentA, documentB, onFocusedConnectionChange, onSelectedNodeChange, options, stateSnapshot, t, viewStateSnapshotA, viewStateSnapshotB]);

    useEffect(() => {
      const treeA = documentA?.tree ?? null;
      const treeB = documentB?.tree ?? null;
      if (!treeA || !treeB || renderedTreesRef.current.treeA !== treeA || renderedTreesRef.current.treeB !== treeB) {
        return;
      }
      try {
        renderScene();
      } catch (error) {
        viewportRef.current?.destroy();
        viewportRef.current = null;
        renderedTreesRef.current = { treeA: null, treeB: null };
        setRenderError(error instanceof Error ? error.message : t('viewer.errorUpdateTanglegram'));
      }
    }, [documentA, documentB, onFocusedConnectionChange, onSelectedNodeChange, options, t, viewStateSnapshotA, viewStateSnapshotB]);

    function zoomBy(factor: number) {
      const current = viewportRef.current?.getTransform().k ?? 1;
      const next = Math.max(0.1, Math.min(current * factor, 32));
      viewportRef.current?.zoomTo(next);
    }

    if (!documentA?.tree || !documentB?.tree) {
      return (
        <div className="viewer-container">
          <svg ref={svgRef} className={`viewer-canvas viewer-canvas-${theme}`} viewBox={`0 0 ${options.width} ${options.height}`} />
          <div className={`viewer-empty viewer-empty-${theme}`}>
            <div className="viewer-empty-split">
              <div className="viewer-empty-card">
                <div className="viewer-card-title">{t('tanglegram.treeA')}</div>
                <p>{documentA?.error || t('viewer.chooseTreeForA')}</p>
              </div>
              <div className="viewer-empty-card">
                <div className="viewer-card-title">{t('tanglegram.treeB')}</div>
                <p>{documentB?.error || t('viewer.chooseTreeForB')}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (renderError) {
      return (
        <div className="viewer-container">
          <svg ref={svgRef} className={`viewer-canvas viewer-canvas-${theme}`} viewBox={`0 0 ${options.width} ${options.height}`} />
          <div className={`viewer-empty viewer-empty-${theme}`}>
            <div className="viewer-empty-card">
              <div className="viewer-card-title">{t('viewer.renderError')}</div>
              <p>{renderError}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="viewer-container">
        <svg ref={svgRef} className={`viewer-canvas viewer-canvas-${theme}`} viewBox={`0 0 ${options.width} ${options.height}`} />
      </div>
    );
  }
);
