import { useI18n } from '../i18n/provider';
import type { AppModel } from '../hooks/useAppModel';
import type { FileDto, ProjectDetailDto } from '../lib/api';
import { CollapsibleSection } from './sections/CollapsibleSection';

interface ProjectFilesSectionProps {
  model: AppModel;
  project: ProjectDetailDto;
  activeTreeFileId: string | null;
  activeFileIdA: string | null;
  activeFileIdB: string | null;
  error: string | null;
  onOpenTree: (file: FileDto) => Promise<void>;
  onLoadToA: (file: FileDto) => Promise<void>;
  onLoadToB: (file: FileDto) => Promise<void>;
}

export function ProjectFilesSection({
  model,
  project,
  activeTreeFileId,
  activeFileIdA,
  activeFileIdB,
  error,
  onOpenTree,
  onLoadToA,
  onLoadToB,
}: ProjectFilesSectionProps) {
  const { t } = useI18n();
  const selectedTreeFile = project.files.find((file) => file.id === activeTreeFileId) ?? null;
  const selectedAFile = project.files.find((file) => file.id === activeFileIdA) ?? null;
  const selectedBFile = project.files.find((file) => file.id === activeFileIdB) ?? null;

  return (
    <CollapsibleSection title={t('projectFiles.title')} defaultExpanded>
      <div className="metrics-list">
        <div className="metrics-row">
          <span>{t('projectFiles.project')}</span>
          <span>{project.project.name}</span>
        </div>
        <div className="metrics-row">
          <span>{t('projectFiles.files')}</span>
          <span>{project.files.length}</span>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {model.layout.mode === 'tree' ? (
        <div className="viewer-file-picker">
          <label className="viewer-file-picker-label" htmlFor="tree-file-select">
            {t('projectFiles.treeFile')}
          </label>
          <select
            id="tree-file-select"
            className="viewer-file-select"
            value={activeTreeFileId ?? ''}
            onChange={(event) => {
              const file = project.files.find((item) => item.id === event.target.value);
              if (file) {
                void onOpenTree(file);
              }
            }}
          >
            <option value="" disabled>
              {t('projectFiles.selectTree')}
            </option>
            {project.files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.name}
              </option>
            ))}
          </select>
          {selectedTreeFile ? (
            <div className="viewer-file-meta">
              <span>{selectedTreeFile.format}</span>
              <span>{selectedTreeFile.leafCount ?? t('projectFiles.notAvailable')} {t('projectFiles.leavesSuffix')}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="viewer-file-picker-group">
          <div className="viewer-file-picker">
            <label className="viewer-file-picker-label" htmlFor="tree-file-select-a">
              {t('projectFiles.treeA')}
            </label>
            <select
              id="tree-file-select-a"
              className="viewer-file-select"
              value={activeFileIdA ?? ''}
              onChange={(event) => {
                const file = project.files.find((item) => item.id === event.target.value);
                if (file) {
                  void onLoadToA(file);
                }
              }}
            >
              <option value="" disabled>
                {t('projectFiles.selectTreeA')}
              </option>
              {project.files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
            {selectedAFile ? (
              <div className="viewer-file-meta">
                <span>{selectedAFile.format}</span>
                <span>{selectedAFile.leafCount ?? t('projectFiles.notAvailable')} {t('projectFiles.leavesSuffix')}</span>
              </div>
            ) : null}
          </div>

          <div className="viewer-file-picker">
            <label className="viewer-file-picker-label" htmlFor="tree-file-select-b">
              {t('projectFiles.treeB')}
            </label>
            <select
              id="tree-file-select-b"
              className="viewer-file-select"
              value={activeFileIdB ?? ''}
              onChange={(event) => {
                const file = project.files.find((item) => item.id === event.target.value);
                if (file) {
                  void onLoadToB(file);
                }
              }}
            >
              <option value="" disabled>
                {t('projectFiles.selectTreeB')}
              </option>
              {project.files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
            {selectedBFile ? (
              <div className="viewer-file-meta">
                <span>{selectedBFile.format}</span>
                <span>{selectedBFile.leafCount ?? t('projectFiles.notAvailable')} {t('projectFiles.leavesSuffix')}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
