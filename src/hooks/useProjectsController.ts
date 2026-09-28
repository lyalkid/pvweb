import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createProject, deleteProject, listProjects, type ProjectDto } from '../lib/api';
import { useI18n } from '../i18n/provider';
import { getErrorMessage } from '../utils/errors';

/**
 * Список проектов из локальной базы.
 *
 * Пришёл на смену useAuthController: в браузерной версии нет ни входа, ни
 * пользователей, поэтому остались только операции над самими проектами.
 */

interface UseProjectsControllerResult {
  projects: ProjectDto[];
  projectsLoading: boolean;
  projectsError: string | null;
  initializing: boolean;
  loadProjects: () => Promise<void>;
  handleCreateProject: (name: string, description: string) => Promise<void>;
  handleDeleteProject: (projectId: string) => Promise<void>;
  setProjects: Dispatch<SetStateAction<ProjectDto[]>>;
}

export function useProjectsController(): UseProjectsControllerResult {
  const { t } = useI18n();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      setProjects(await listProjects());
    } catch (error) {
      setProjectsError(getErrorMessage(error, t('projects.loadFailed')));
    } finally {
      setProjectsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;

    void (async () => {
      await loadProjects();
      if (active) {
        setInitializing(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadProjects]);

  const handleCreateProject = useCallback(async (name: string, description: string) => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const created = await createProject(name, description);
      setProjects((current) => [created, ...current]);
    } catch (error) {
      setProjectsError(getErrorMessage(error, t('projects.createFailed')));
    } finally {
      setProjectsLoading(false);
    }
  }, [t]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      await deleteProject(projectId);
      setProjects((current) => current.filter((project) => project.id !== projectId));
    } catch (error) {
      setProjectsError(getErrorMessage(error, t('projects.deleteFailed')));
    } finally {
      setProjectsLoading(false);
    }
  }, [t]);

  return {
    projects,
    projectsLoading,
    projectsError,
    initializing,
    loadProjects,
    handleCreateProject,
    handleDeleteProject,
    setProjects,
  };
}
