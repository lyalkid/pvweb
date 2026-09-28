import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useI18n } from '../../i18n/provider';
import {
  PhyloRenderer,
  PhyloTreeModel,
  ViewState,
  type ViewStateSnapshot,
  type PhyloTree,
  type TreeRenderOptions,
} from 'phylo-tree-lib';
import type { AppTheme, ViewerCommands } from '../../hooks/useAppModel';
import type { ViewerDocument } from '../../utils/viewer-document';
import { exportPngElement, exportSvgElement } from '../../utils/viewer-export';

interface SingleTreeViewerProps {
  document: ViewerDocument | null;
  viewStateSnapshot: ViewStateSnapshot | null;
  selectedNodeId: string | null;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onToggleCollapseSelected: () => void;
  onSetSelectedColor: (color: string) => void;
  onClearSelectedColor: () => void;
  onExpandAll: () => void;
  onRerootSelected: () => Promise<void>;
  onSwapSelectedChildren: () => Promise<void>;
  onPruneSelected: () => Promise<void>;
  onLadderize: (direction: 'ascending' | 'descending') => Promise<void>;
  options: TreeRenderOptions;
  theme: AppTheme;
}

export const SingleTreeViewer = forwardRef<ViewerCommands, SingleTreeViewerProps>(
  function SingleTreeViewer(
    {
      document,
      viewStateSnapshot,
      selectedNodeId,
      onSelectedNodeChange,
      onToggleCollapseSelected,
      onSetSelectedColor,
      onClearSelectedColor,
      onExpandAll,
      onRerootSelected,
      onSwapSelectedChildren,
      onPruneSelected,
      onLadderize,
      options,
      theme,
    },
    ref
  ) {
    const { t } = useI18n();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const rendererRef = useRef<PhyloRenderer | null>(null);
    const zoomRef = useRef(1);
    const renderedTreeRef = useRef<PhyloTree | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

    const selectedNode = useMemo(() => {
      if (!document?.tree || !selectedNodeId) {
        return null;
      }
      return new PhyloTreeModel(document.tree).findById(selectedNodeId);
    }, [document?.tree, selectedNodeId]);

    const isSelectedCollapsed = selectedNodeId
      ? (viewStateSnapshot?.collapsed ?? []).includes(selectedNodeId)
      : false;
    const canSwapSelected = Boolean(selectedNode && selectedNode.children.length >= 2);
    const canPruneSelected = Boolean(selectedNodeId && document?.tree && document.tree.root.id !== selectedNodeId);

    function createRenderer() {
      if (!svgRef.current) {
        return null;
      }

      const renderer = new PhyloRenderer(svgRef.current);
      renderer.on('nodeClick', (payload, event) => {
        onSelectedNodeChange(payload.nodeId);
        if (event.button === 2 && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setContextMenu({
            nodeId: payload.nodeId,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
        } else {
          setContextMenu(null);
        }
      });
      renderer.on('backgroundClick', () => {
        onSelectedNodeChange(null);
        setContextMenu(null);
      });
      renderer.on('nodeHover', (payload) => {
        setHoveredNodeId(payload.nodeId);
      });
      rendererRef.current = renderer;
      return renderer;
    }

    useImperativeHandle(ref, () => ({
      zoomIn() {
        zoomBy(1.2);
      },
      zoomOut() {
        zoomBy(1 / 1.2);
      },
      resetView() {
        zoomRef.current = 1;
        rendererRef.current?.resetView();
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

    useEffect(() => {
      if (!svgRef.current) {
        return;
      }

      const renderer = createRenderer();
      if (!renderer) {
        return;
      }

      return () => {
        renderer.destroy();
        rendererRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }
      const closeMenu = () => setContextMenu(null);
      window.addEventListener('click', closeMenu);
      window.addEventListener('resize', closeMenu);
      return () => {
        window.removeEventListener('click', closeMenu);
        window.removeEventListener('resize', closeMenu);
      };
    }, []);

    useEffect(() => {
      setRenderError(null);
      setContextMenu(null);
      const tree = document?.tree ?? null;
      if (!tree) {
        renderedTreeRef.current = null;
        setHoveredNodeId(null);
        return;
      }
      try {
        const renderer = rendererRef.current ?? createRenderer();
        renderer?.render(tree, ViewState.fromJSON(viewStateSnapshot), options);
        renderedTreeRef.current = tree;
      } catch (error) {
        rendererRef.current?.destroy();
        rendererRef.current = null;
        renderedTreeRef.current = null;
        createRenderer();
        setRenderError(error instanceof Error ? error.message : t('viewer.errorRenderTree'));
      }
    }, [document, onSelectedNodeChange, options, t, viewStateSnapshot]);

    useEffect(() => {
      const tree = document?.tree ?? null;
      if (!tree || renderedTreeRef.current !== tree) {
        return;
      }
      try {
        rendererRef.current?.updateVisuals(options);
      } catch (error) {
        rendererRef.current?.destroy();
        rendererRef.current = null;
        renderedTreeRef.current = null;
        createRenderer();
        setRenderError(error instanceof Error ? error.message : t('viewer.errorUpdateTree'));
      }
    }, [document, onSelectedNodeChange, options, t]);

    function zoomBy(factor: number) {
      const next = Math.max(0.1, Math.min(zoomRef.current * factor, 32));
      zoomRef.current = next;
      rendererRef.current?.zoomTo(next);
    }

    function openContextMenu(event: ReactMouseEvent<SVGSVGElement>) {
      event.preventDefault();
      if (!containerRef.current) {
        return;
      }
      const targetNodeId = hoveredNodeId ?? selectedNodeId;
      if (!targetNodeId) {
        setContextMenu(null);
        return;
      }
      onSelectedNodeChange(targetNodeId);
      const rect = containerRef.current.getBoundingClientRect();
      setContextMenu({
        nodeId: targetNodeId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }

    if (!document?.tree) {
      return (
        <div ref={containerRef} className="viewer-container">
          <svg
            ref={svgRef}
            className={`viewer-canvas viewer-canvas-${theme}`}
            viewBox={`0 0 ${options.width} ${options.height}`}
            onContextMenu={openContextMenu}
          />
          <div className={`viewer-empty viewer-empty-${theme}`}>
            <div className="viewer-empty-card">
              <div className="viewer-card-title">{document ? t('viewer.treeUnavailable') : t('viewer.noTreeSelected')}</div>
              <p>{document?.error || t('viewer.chooseTreeForViewer')}</p>
              {document?.warning ? <p>{document.warning}</p> : null}
            </div>
          </div>
        </div>
      );
    }

    if (renderError) {
      return (
        <div ref={containerRef} className="viewer-container">
          <svg
            ref={svgRef}
            className={`viewer-canvas viewer-canvas-${theme}`}
            viewBox={`0 0 ${options.width} ${options.height}`}
            onContextMenu={openContextMenu}
          />
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
      <div ref={containerRef} className="viewer-container">
        <svg
          ref={svgRef}
          className={`viewer-canvas viewer-canvas-${theme}`}
          viewBox={`0 0 ${options.width} ${options.height}`}
          onContextMenu={openContextMenu}
        />
        {contextMenu ? (
          <div
            className={`viewer-context-menu viewer-context-menu-${theme}`}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="viewer-context-menu-title">{contextMenu.nodeId}</div>
            <button type="button" onClick={() => { onToggleCollapseSelected(); setContextMenu(null); }}>
              {isSelectedCollapsed ? t('singleTree.expandSelected') : t('singleTree.collapseSelected')}
            </button>
            <button type="button" onClick={() => { void onRerootSelected(); setContextMenu(null); }}>
              {t('singleTree.reroot')}
            </button>
            <button type="button" disabled={!canSwapSelected} onClick={() => { void onSwapSelectedChildren(); setContextMenu(null); }}>
              {t('singleTree.swapChildren')}
            </button>
            <button type="button" disabled={!canPruneSelected} onClick={() => { void onPruneSelected(); setContextMenu(null); }}>
              {t('singleTree.pruneSubtree')}
            </button>
            <button type="button" onClick={() => { void onLadderize('ascending'); setContextMenu(null); }}>
              {t('singleTree.ladderizeAsc')}
            </button>
            <button type="button" onClick={() => { void onLadderize('descending'); setContextMenu(null); }}>
              {t('singleTree.ladderizeDesc')}
            </button>
            <button type="button" onClick={() => { onSetSelectedColor('#d23f57'); setContextMenu(null); }}>
              {t('viewer.contextColorRed')}
            </button>
            <button type="button" onClick={() => { onClearSelectedColor(); setContextMenu(null); }}>
              {t('common.clearColor')}
            </button>
            <button type="button" onClick={() => { onExpandAll(); setContextMenu(null); }}>
              {t('singleTree.expandAll')}
            </button>
          </div>
        ) : null}
      </div>
    );
  }
);
