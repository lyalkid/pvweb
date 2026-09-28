import { useCallback, type ReactNode } from 'react';
import { AppLayout } from './components/AppLayout';
import { useAppModel } from './hooks/useAppModel';
import { useProjectsController } from './hooks/useProjectsController';
import { useRouteState } from './hooks/useRouteState';
import { useWorkspaceController } from './hooks/useWorkspaceController';
import { AboutScreen } from './screens/AboutScreen';
import { ProjectScreen } from './screens/ProjectScreen';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { filterViewerSupportedFiles } from './utils/formats';
import { useI18n } from './i18n/provider';

export default function App() {
  const model = useAppModel();
  const { route, navigate } = useRouteState();
  const { t } = useI18n();

  const {
    projects,
    projectsLoading,
    projectsError,
    initializing,
    loadProjects,
    handleCreateProject,
    handleDeleteProject,
  } = useProjectsController();

  const {
    selectedProject,
    workspaceBusy,
    workspaceError,
    uploadFeedback,
    workspace,
    resetWorkspaceState,
    handleUploadFiles,
    handleCreateManualFile,
    handleDeleteFile,
    handleReorderFiles,
  } = useWorkspaceController({
    route,
    navigate,
    model,
  });

  const handleDeleteProjectWithSelection = useCallback(async (projectId: string) => {
    await handleDeleteProject(projectId);
    if (selectedProject?.project.id === projectId) {
      resetWorkspaceState();
    }
  }, [handleDeleteProject, resetWorkspaceState, selectedProject?.project.id]);

  // После импорта копии прежние идентификаторы недействительны, поэтому
  // открытый проект сбрасывается вместе с перечитыванием списка.
  const handleReloadProjects = useCallback(() => {
    resetWorkspaceState();
    navigate({ kind: 'projects' }, true);
    void loadProjects();
  }, [loadProjects, navigate, resetWorkspaceState]);

  const wrapThemedScreen = useCallback((content: ReactNode) => (
    <div className={`theme-${model.layout.theme}`}>
      {content}
    </div>
  ), [model.layout.theme]);

  if (initializing) {
    return wrapThemedScreen(
      <div className="screen-shell centered-screen">
        <div className="auth-card">{t('common.loadingApp')}</div>
      </div>
    );
  }

  if (route.kind === 'about') {
    return wrapThemedScreen(
      <AboutScreen onBack={() => navigate({ kind: 'projects' })} />
    );
  }

  if (route.kind === 'projects') {
    return wrapThemedScreen(
      <ProjectsScreen
        projects={projects}
        loading={projectsLoading}
        error={projectsError}
        onCreateProject={handleCreateProject}
        onOpenProject={(projectId) => navigate({ kind: 'project', projectId })}
        onDeleteProject={handleDeleteProjectWithSelection}
        onReloadProjects={handleReloadProjects}
        onOpenAbout={() => navigate({ kind: 'about' })}
      />
    );
  }

  if (!selectedProject) {
    return wrapThemedScreen(
      <div className="screen-shell centered-screen">
        <div className="auth-card">{workspaceError ?? t('common.openingProject')}</div>
      </div>
    );
  }

  if (route.kind === 'project') {
    return wrapThemedScreen(
      <ProjectScreen
        project={selectedProject}
        busy={workspaceBusy}
        error={workspaceError}
        uploadFeedback={uploadFeedback}
        onBackToProjects={() => {
          resetWorkspaceState();
          navigate({ kind: 'projects' });
        }}
        onOpenViewer={() => navigate({ kind: 'workspace', projectId: selectedProject.project.id })}
        onUploadFiles={handleUploadFiles}
        onCreateManualFile={handleCreateManualFile}
        onOpenTree={workspace!.onOpenTree}
        onDeleteFile={handleDeleteFile}
        onReorderFiles={handleReorderFiles}
      />
    );
  }

  return (
    <AppLayout
      model={model}
      workspace={{
        ...workspace!,
        project: {
          ...workspace!.project,
          files: filterViewerSupportedFiles(workspace!.project.files),
        },
      }}
    />
  );
}
