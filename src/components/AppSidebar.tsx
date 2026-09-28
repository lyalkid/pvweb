import { LocaleSwitcher } from './LocaleSwitcher';
import type { AppModel } from '../hooks/useAppModel';
import { useI18n } from '../i18n/provider';

interface AppSidebarProps {
  model: AppModel;
  onBackToProject: () => void;
  onBackToProjects: () => void;
}

export function AppSidebar({ model, onBackToProject, onBackToProjects }: AppSidebarProps) {
  const isTree = model.layout.mode === 'tree';
  const { t } = useI18n();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <span className="sidebar-brand-icon">PV</span>
          <div className="sidebar-brand-copy">
            <span className="sidebar-brand-title">Phylo Viewer</span>
            <span className="sidebar-brand-subtitle">{t('sidebar.service')}</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-actions">
        <button
          type="button"
          className={`sidebar-action sidebar-action-tree${isTree ? ' is-active' : ''}`}
          onClick={() => model.actions.setMode('tree')}
        >
          <span className="sidebar-icon sidebar-icon-tree" aria-hidden="true" />
          <span className="sidebar-label">{t('sidebar.tree')}</span>
        </button>
        <button
          type="button"
          className={`sidebar-action sidebar-action-compare${!isTree ? ' is-active' : ''}`}
          onClick={() => model.actions.setMode('tanglegram')}
        >
          <span className="sidebar-icon sidebar-icon-compare" aria-hidden="true" />
          <span className="sidebar-label">{t('sidebar.compare')}</span>
        </button>
        <button type="button" className="sidebar-action sidebar-action-settings" onClick={model.actions.toggleMenu}>
          <span className="sidebar-icon sidebar-icon-settings" aria-hidden="true" />
          <span className="sidebar-label">{t('sidebar.settings')}</span>
        </button>
        <button type="button" className="sidebar-action sidebar-action-projects" onClick={onBackToProjects}>
          <span className="sidebar-icon sidebar-icon-projects" aria-hidden="true" />
          <span className="sidebar-label">{t('sidebar.projects')}</span>
        </button>
        <button type="button" className="sidebar-action sidebar-action-back" onClick={onBackToProject}>
          <span className="sidebar-icon sidebar-icon-back" aria-hidden="true" />
          <span className="sidebar-label">{t('sidebar.backToProject')}</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <LocaleSwitcher className="locale-switcher-inline" />
        <button type="button" className="sidebar-theme" onClick={model.actions.toggleTheme}>
          {model.layout.theme === 'dark' ? t('common.lightTheme') : t('common.darkTheme')}
        </button>
      </div>
    </aside>
  );
}
