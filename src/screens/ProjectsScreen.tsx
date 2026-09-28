import { useState } from 'react';
import type { ProjectDto } from '../lib/api';
import { BackupControls } from '../components/BackupControls';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { useI18n } from '../i18n/provider';

interface ProjectsScreenProps {
  projects: ProjectDto[];
  loading: boolean;
  error: string | null;
  onCreateProject: (name: string, description: string) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  onReloadProjects: () => void;
  onOpenAbout: () => void;
}

export function ProjectsScreen({
  projects,
  loading,
  error,
  onCreateProject,
  onOpenProject,
  onDeleteProject,
  onReloadProjects,
  onOpenAbout,
}: ProjectsScreenProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const totalTrees = projects.reduce((sum, project) => sum + project.fileCount, 0);
  const { locale, t } = useI18n();

  const resetCreateForm = () => {
    setName('');
    setDescription('');
    setCreateOpen(false);
  };

  return (
    <div className="screen-shell projects-screen">
      <div className="projects-hero">
        <div className="projects-hero-copy">
          <span className="projects-eyebrow">{t('projects.eyebrow')}</span>
          <h1>{t('projects.title')}</h1>
          <p className="projects-subtitle">{t('projects.subtitle')}</p>
          <div className="projects-hero-meta">
            <div className="projects-account-chip">
              <span className="projects-account-label">{t('projects.storageLabel')}</span>
              <strong>{t('projects.storageValue')}</strong>
            </div>
            <div className="projects-summary-inline">
              <span><strong>{projects.length}</strong> {pluralize(locale, projects.length, 'project')}</span>
              <span><strong>{totalTrees}</strong> {pluralize(locale, totalTrees, 'tree')}</span>
            </div>
          </div>
        </div>
        <div className="projects-hero-side">
          <div className="screen-toolbar screen-toolbar-end">
            <LocaleSwitcher className="locale-switcher-inline" />
          </div>
          <div className="projects-hero-actions">
            <button type="button" onClick={onOpenAbout}>
              {t('common.about')}
            </button>
            <button type="button" className="projects-primary-button" onClick={() => setCreateOpen(true)}>
              {t('projects.newProjectButton')}
            </button>
          </div>
          <BackupControls onImported={onReloadProjects} />
        </div>
      </div>

      <div className="projects-dashboard-grid">
        <section className="projects-list-panel">
          <div className="projects-panel-heading projects-panel-heading-inline">
            <div>
              <span className="projects-panel-kicker">{t('projects.catalog')}</span>
              <h3>{t('projects.yourProjects')}</h3>
            </div>
            <span className="projects-list-count">{projects.length} {t('projects.totalSuffix')}</span>
          </div>
          {error && !createOpen ? <div className="error">{error}</div> : null}
          <div className="projects-catalog">
            {projects.map((project) => (
              <article key={project.id} className="projects-catalog-card">
                <div className="projects-catalog-topline">
                  <div className="projects-catalog-titleblock">
                    <h4>
                      <span>{project.name}</span>
                      <span className="projects-card-main-count">{project.fileCount} {pluralize(locale, project.fileCount, 'tree')}</span>
                    </h4>
                    <p>{project.description || t('projects.noDescription')}</p>
                    <span className="projects-card-updated">{t('projects.updatedUnknown')}</span>
                  </div>
                </div>
                <div className="projects-catalog-footer">
                  <div className="projects-catalog-actions">
                    <button
                      type="button"
                      className="projects-primary-button projects-primary-button-secondary"
                      onClick={() => onOpenProject(project.id)}
                    >
                      {t('projects.openProject')}
                    </button>
                    <div className="projects-card-menu">
                      <button
                        type="button"
                        className="projects-menu-button"
                        aria-label={t('projects.projectActions')}
                        onClick={() => setProjectMenuId((current) => (current === project.id ? null : project.id))}
                      >
                        ···
                      </button>
                      {projectMenuId === project.id ? (
                        <div className="projects-menu-popover">
                          <button
                            type="button"
                            className="projects-danger-menu-item"
                            onClick={() => {
                              setProjectMenuId(null);
                              if (window.confirm(t('projects.confirmDeleteProject', { name: project.name }))) {
                                void onDeleteProject(project.id);
                              }
                            }}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {!projects.length ? (
              <div className="projects-empty-state">
                <h4>{t('projects.emptyTitle')}</h4>
                <p>{t('projects.emptyDescription')}</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
      {createOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={resetCreateForm}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-project-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <span className="projects-panel-kicker">{t('projects.newProject')}</span>
                <h3 id="create-project-title">{t('projects.createProject')}</h3>
                <p>{t('projects.createProjectDescription')}</p>
              </div>
              <button type="button" className="modal-close-button" onClick={resetCreateForm} aria-label={t('common.close')}>
                ×
              </button>
            </div>
            <div className="projects-create-form">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('projects.projectNamePlaceholder')}
                autoFocus
              />
              <textarea
                className="projects-create-textarea"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('projects.projectDescriptionPlaceholder')}
              />
              <div className="modal-actions">
                <button type="button" onClick={resetCreateForm}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="projects-primary-button"
                  disabled={loading || !name.trim()}
                  onClick={async () => {
                    await onCreateProject(name, description);
                    resetCreateForm();
                  }}
                >
                  {t('common.create')}
                </button>
              </div>
            </div>
            {error ? <div className="error">{error}</div> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function pluralize(locale: 'ru' | 'en', count: number, noun: 'project' | 'tree') {
  if (locale === 'ru') {
    return noun === 'project' ? (count === 1 ? 'проект' : 'проектов') : count === 1 ? 'дерево' : 'деревьев';
  }
  return noun === 'project' ? (count === 1 ? 'project' : 'projects') : count === 1 ? 'tree' : 'trees';
}
