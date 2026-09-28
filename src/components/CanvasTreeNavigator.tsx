import { useI18n } from '../i18n/provider';
import type { AppMode } from '../hooks/useAppModel';
import type { FileDto } from '../lib/api';

interface CanvasTreeNavigatorProps {
  mode: AppMode;
  files: FileDto[];
  activeTreeFileId: string | null;
  activeFileIdA: string | null;
  activeFileIdB: string | null;
  onOpenTree: (file: FileDto) => Promise<void>;
  onLoadToA: (file: FileDto) => Promise<void>;
  onLoadToB: (file: FileDto) => Promise<void>;
}

export function CanvasTreeNavigator({
  mode,
  files,
  activeTreeFileId,
  activeFileIdA,
  activeFileIdB,
  onOpenTree,
  onLoadToA,
  onLoadToB,
}: CanvasTreeNavigatorProps) {
  if (!files.length) {
    return null;
  }

  if (mode === 'tree') {
    return (
      <div className="canvas-tree-navigator">
        <NavigatorCard
          files={files}
          activeId={activeTreeFileId}
          onPrevious={() => {
            const file = resolveAdjacent(files, activeTreeFileId, -1);
            if (file) {
              void onOpenTree(file);
            }
          }}
          onNext={() => {
            const file = resolveAdjacent(files, activeTreeFileId, 1);
            if (file) {
              void onOpenTree(file);
            }
          }}
          disablePrevious={resolveAdjacent(files, activeTreeFileId, -1) === null}
          disableNext={resolveAdjacent(files, activeTreeFileId, 1) === null}
        />
      </div>
    );
  }

  return (
    <div className="canvas-tree-navigator canvas-tree-navigator-dual">
      <NavigatorCard
        label="A"
        files={files}
        activeId={activeFileIdA}
        onPrevious={() => {
          const file = resolveAdjacent(files, activeFileIdA, -1);
          if (file) {
            void onLoadToA(file);
          }
        }}
        onNext={() => {
          const file = resolveAdjacent(files, activeFileIdA, 1);
          if (file) {
            void onLoadToA(file);
          }
        }}
        disablePrevious={resolveAdjacent(files, activeFileIdA, -1) === null}
        disableNext={resolveAdjacent(files, activeFileIdA, 1) === null}
      />
      <NavigatorCard
        label="B"
        files={files}
        activeId={activeFileIdB}
        onPrevious={() => {
          const file = resolveAdjacent(files, activeFileIdB, -1);
          if (file) {
            void onLoadToB(file);
          }
        }}
        onNext={() => {
          const file = resolveAdjacent(files, activeFileIdB, 1);
          if (file) {
            void onLoadToB(file);
          }
        }}
        disablePrevious={resolveAdjacent(files, activeFileIdB, -1) === null}
        disableNext={resolveAdjacent(files, activeFileIdB, 1) === null}
      />
    </div>
  );
}

function NavigatorCard({
  label,
  files,
  activeId,
  onPrevious,
  onNext,
  disablePrevious,
  disableNext,
}: {
  label?: string;
  files: FileDto[];
  activeId: string | null;
  onPrevious: () => void;
  onNext: () => void;
  disablePrevious: boolean;
  disableNext: boolean;
}) {
  const { t } = useI18n();
  const activeFile = activeId ? files.find((item) => item.id === activeId) ?? null : null;
  const activeIndex = activeId ? files.findIndex((item) => item.id === activeId) : -1;
  const positionText = activeIndex >= 0
    ? t('navigator.filePosition', { current: activeIndex + 1, total: files.length })
    : t('navigator.noTreeSelected');

  return (
    <div className="canvas-tree-inline">
      {label ? <div className="canvas-tree-badge">{label}</div> : null}
      <button
        type="button"
        className="canvas-tree-inline-button"
        onClick={onPrevious}
        disabled={disablePrevious}
        aria-label={t('navigator.previousTree')}
      >
        ←
      </button>
      <div className="canvas-tree-inline-position">{positionText}</div>
      <div className="canvas-tree-inline-name" title={activeFile?.name ?? t('navigator.noTreeSelected')}>
        {activeFile?.name ?? t('navigator.noTreeSelected')}
      </div>
      <button
        type="button"
        className="canvas-tree-inline-button"
        onClick={onNext}
        disabled={disableNext}
        aria-label={t('navigator.nextTree')}
      >
        →
      </button>
    </div>
  );
}

function resolveAdjacent(files: FileDto[], activeId: string | null, delta: -1 | 1) {
  if (!files.length) {
    return null;
  }
  const currentIndex = activeId ? files.findIndex((item) => item.id === activeId) : -1;
  const nextIndex = currentIndex === -1 ? (delta === 1 ? 0 : files.length - 1) : currentIndex + delta;
  if (nextIndex < 0 || nextIndex >= files.length) {
    return null;
  }
  return files[nextIndex];
}
