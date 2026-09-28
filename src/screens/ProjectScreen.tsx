import { useEffect, useMemo, useState } from 'react';
import { parseNewick, parseNexus, parsePhyloXML } from 'phylo-tree-lib';
import type { FileDto, ManualTreeFormat, ProjectDetailDto } from '../lib/api';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { useI18n } from '../i18n/provider';
import { isViewerSupportedFormat } from '../utils/formats';

interface ProjectScreenProps {
  project: ProjectDetailDto;
  busy: boolean;
  error: string | null;
  uploadFeedback: { tone: 'idle' | 'progress' | 'success' | 'error'; message: string | null };
  onBackToProjects: () => void;
  onOpenViewer: () => void;
  onUploadFiles: (files: FileList | null) => Promise<void>;
  onCreateManualFile: (name: string, content: string, format: ManualTreeFormat) => Promise<boolean>;
  onOpenTree: (file: FileDto) => Promise<void>;
  onDeleteFile: (file: FileDto) => Promise<void>;
  onReorderFiles: (fileIds: string[]) => Promise<void>;
}

export function ProjectScreen({
  project,
  busy,
  error,
  uploadFeedback,
  onBackToProjects,
  onOpenViewer,
  onUploadFiles,
  onCreateManualFile,
  onOpenTree,
  onDeleteFile,
  onReorderFiles,
}: ProjectScreenProps) {
  const [pageSize, setPageSize] = useState<'10' | '20' | '50' | '100' | 'all'>('10');
  const [page, setPage] = useState(1);
  const [manualName, setManualName] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualFormat, setManualFormat] = useState<ManualTreeFormat>('newick');
  const { locale, t } = useI18n();
  const manualParseError = useMemo(() => {
    if (!manualContent.trim()) {
      return null;
    }
    try {
      if (manualFormat === 'newick') {
        parseNewick(manualContent);
      } else if (manualFormat === 'nexus') {
        parseNexus(manualContent);
      } else {
        parsePhyloXML(manualContent);
      }
      return null;
    } catch (parseError) {
      return parseError instanceof Error ? parseError.message : t('formats.parseTreeError');
    }
  }, [manualContent, manualFormat, t]);
  const totalLeaves = useMemo(
    () => project.files.reduce((sum, file) => sum + (file.leafCount ?? 0), 0),
    [project.files]
  );
  const lastUpdated = useMemo(() => {
    const dates = project.files
      .map((file) => file.updatedAt ?? file.createdAt)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());
    return dates[0] ?? null;
  }, [project.files]);

  const visibleFiles = useMemo(() => {
    if (pageSize === 'all') {
      return project.files;
    }
    const limit = Number(pageSize);
    const start = (page - 1) * limit;
    return project.files.slice(start, start + limit);
  }, [page, pageSize, project.files]);

  const pageCount = useMemo(() => {
    if (pageSize === 'all') {
      return 1;
    }
    return Math.max(1, Math.ceil(project.files.length / Number(pageSize)));
  }, [pageSize, project.files.length]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const moveFile = async (fileId: string, direction: 'up' | 'down') => {
    const index = project.files.findIndex((file) => file.id === fileId);
    if (index === -1) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= project.files.length) {
      return;
    }
    const next = [...project.files];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    await onReorderFiles(next.map((file) => file.id));
  };

  const createManualFile = async () => {
    const baseName = manualName.trim() || t('project.manualDefaultName');
    const created = await onCreateManualFile(baseName, manualContent, manualFormat);
    if (created) {
      setManualName('');
      setManualContent('');
      setManualFormat('newick');
    }
  };

  return (
    <div className="screen-shell projects-screen project-overview-screen">
      <div className="project-overview-hero">
        <div className="project-overview-copy">
          <span className="projects-eyebrow">{t('project.eyebrow')}</span>
          <h1>{project.project.name}</h1>
          <p className="project-overview-subtitle">
            {project.project.description || t('project.fallbackDescription')}
          </p>
          <div className="project-overview-meta">
            <strong>{project.files.length} {pluralizeTree(locale, project.files.length)}</strong>
            <span>{formatNumber(locale, totalLeaves)} {t('project.leavesTotalSuffix')}</span>
            <small>{lastUpdated ? `${t('project.updatedPrefix')} ${formatDate(lastUpdated.toISOString())}` : t('project.noUpdatesYet')}</small>
          </div>
        </div>
        <div className="project-overview-actions">
          <LocaleSwitcher className="locale-switcher-inline" />
          <button type="button" onClick={onBackToProjects}>
            {t('common.backToProjects')}
          </button>
          <button type="button" className="projects-primary-button" onClick={onOpenViewer}>
            {t('common.openViewer')}
          </button>
        </div>
      </div>

      <div className="project-overview-grid">
        <aside className="project-tools-panel">
          <div className="projects-panel-heading">
            <span className="projects-panel-kicker">{t('project.toolsEyebrow')}</span>
            <h3>{t('project.uploadTitle')}</h3>
            <p>{t('project.uploadDescription')}</p>
          </div>
          <div className="project-manual-create">
            <label className="label" htmlFor="project-manual-tree-content">
              {t('project.manualTitle')}
            </label>
            <textarea
              id="project-manual-tree-content"
              value={manualContent}
              onChange={(event) => setManualContent(event.target.value)}
              placeholder={t('project.manualPlaceholder')}
            />
            <div className="project-manual-meta">
              <input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder={t('project.manualNamePlaceholder')}
                aria-label={t('project.manualNameLabel')}
              />
              <select
                value={manualFormat}
                onChange={(event) => setManualFormat(event.target.value as ManualTreeFormat)}
                aria-label={t('project.manualFormat')}
              >
                <option value="newick">Newick</option>
                <option value="nexus">NEXUS</option>
                <option value="phyloxml">PhyloXML</option>
              </select>
            </div>
            {manualParseError ? <div className="project-manual-error">{manualParseError}</div> : null}
            <button
              type="button"
              className="projects-primary-button"
              onClick={() => void createManualFile()}
              disabled={busy || !manualContent.trim() || Boolean(manualParseError)}
            >
              {t('project.manualCreate')}
            </button>
          </div>
          <div className="project-upload-divider"><span>{t('project.orUploadFile')}</span></div>
          <label className="project-upload-dropzone">
            <input
              type="file"
              multiple
              accept=".nwk,.newick,.tre,.tree,.txt,.nex,.nexus,.xml,.phyloxml,text/plain,text/xml,application/xml"
              onChange={async (event) => {
                await onUploadFiles(event.currentTarget.files);
                event.currentTarget.value = '';
              }}
            />
            <strong>{t('project.uploadDropzoneTitle')}</strong>
            <span>{t('project.uploadDropzoneSubtitle')}</span>
          </label>
          <div className={`project-upload-feedback project-upload-feedback-${uploadFeedback.tone}`}>
            {uploadFeedback.message || t('project.uploadIdle')}
          </div>
          <div className="project-summary-stack">
            <div className="project-summary-card-lite">
              <span className="project-summary-label">{t('project.projectSize')}</span>
              <strong>{project.files.length} {t('project.documents')}</strong>
            </div>
            <div className="project-summary-card-lite">
              <span className="project-summary-label">{t('project.viewerMode')}</span>
              <strong>{t('project.viewerModeValue')}</strong>
            </div>
          </div>
          {error ? <div className="error">{error}</div> : null}
        </aside>

        <section className="project-files-panel">
          <div className="project-table-header">
            <div className="projects-panel-heading projects-panel-heading-tight">
              <span className="projects-panel-kicker">{t('project.filesEyebrow')}</span>
              <h3>{t('project.filesTitle')}</h3>
            </div>
            <label className="project-table-size">
              <span>{t('common.rows')}</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(event.target.value as '10' | '20' | '50' | '100' | 'all');
                  setPage(1);
                }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="all">{t('project.allRows')}</option>
              </select>
            </label>
          </div>
          {project.files.length ? (
            <>
              <div className="project-table-wrapper">
                <table className="project-table">
                  <thead>
                    <tr>
                      <th>{t('project.move')}</th>
                      <th>{t('project.tree')}</th>
                      <th>{t('project.leaves')}</th>
                      <th>{t('project.updated')}</th>
                      <th>{t('project.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFiles.map((file) => {
                      const absoluteIndex = project.files.findIndex((item) => item.id === file.id);
                      return (
                        <tr key={file.id}>
                          <td>
                            <div className="table-move-buttons">
                              <span className="table-drag-handle" aria-hidden="true">⠿</span>
                              <button
                                type="button"
                                className="table-move-button"
                                onClick={() => void moveFile(file.id, 'up')}
                                disabled={busy || absoluteIndex === 0}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="table-move-button"
                                onClick={() => void moveFile(file.id, 'down')}
                                disabled={busy || absoluteIndex === project.files.length - 1}
                              >
                                ↓
                              </button>
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="table-link-button"
                              onClick={() => void onOpenTree(file)}
                              disabled={!isViewerSupportedFormat(file.format)}
                              title={!isViewerSupportedFormat(file.format) ? t('formats.viewerSupportMessage') : undefined}
                            >
                              {file.name}
                            </button>
                          </td>
                          <td>{file.leafCount ?? t('projectFiles.notAvailable')}</td>
                          <td>{formatDate(file.updatedAt ?? file.createdAt)}</td>
                          <td>
                            {!isViewerSupportedFormat(file.format) ? (
                              <span className="table-inline-note">{t('common.unsupported')}</span>
                            ) : null}
                            <button
                              type="button"
                              className="table-delete-button"
                              onClick={() => {
                                if (window.confirm(t('project.confirmDeleteFile', { name: file.name }))) {
                                  void onDeleteFile(file);
                                }
                              }}
                              disabled={busy}
                              aria-label={t('project.deleteFileAria', { name: file.name })}
                            >
                              🗑
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="project-table-pagination">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                  {t('common.prev')}
                </button>
                <span>
                  {t('common.page')} {page} {t('common.of')} {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page >= pageCount}
                >
                  {t('common.next')}
                </button>
              </div>
            </>
          ) : (
            <div className="projects-empty-state">
              <h4>{t('project.noDocumentsTitle')}</h4>
              <p>{t('project.noDocumentsDescription')}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function pluralizeTree(locale: 'ru' | 'en', count: number) {
  if (locale === 'ru') {
    return count === 1 ? 'дерево' : 'деревьев';
  }
  return count === 1 ? 'tree' : 'trees';
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatNumber(locale: 'ru' | 'en', value: number) {
  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US').format(value);
}
