/**
 * Маршруты приложения.
 *
 * Адрес хранится в хеше (#/projects/...), а не в пути. GitHub Pages отдаёт
 * статику и не умеет переписывать произвольный путь на index.html, поэтому при
 * перезагрузке страницы с обычным путём сервер вернул бы 404. Хеш до сервера не
 * доходит, и глубокие ссылки работают без дополнительной настройки.
 *
 * Экран входа убран вместе с аутентификацией: стартовый маршрут — список проектов.
 */

export type RouteState =
  | { kind: 'about' }
  | { kind: 'projects' }
  | { kind: 'project'; projectId: string }
  | { kind: 'workspace'; projectId: string };

export const DEFAULT_ROUTE: RouteState = { kind: 'projects' };

export function parseRoute(hash: string): RouteState {
  const path = normalizeHash(hash);

  if (path === '/' || path === '/projects') {
    return { kind: 'projects' };
  }
  if (path === '/about') {
    return { kind: 'about' };
  }

  const workspaceMatch = path.match(/^\/projects\/([^/]+)\/view$/);
  if (workspaceMatch) {
    return { kind: 'workspace', projectId: workspaceMatch[1] };
  }

  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    return { kind: 'project', projectId: projectMatch[1] };
  }

  return DEFAULT_ROUTE;
}

export function routeToPath(route: RouteState): string {
  switch (route.kind) {
    case 'about':
      return '/about';
    case 'projects':
      return '/projects';
    case 'project':
      return `/projects/${route.projectId}`;
    case 'workspace':
      return `/projects/${route.projectId}/view`;
  }
}

/** Превращает маршрут в значение для location.hash. */
export function routeToHash(route: RouteState): string {
  return `#${routeToPath(route)}`;
}

function normalizeHash(hash: string): string {
  const withoutPrefix = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!withoutPrefix) {
    return '/';
  }
  const withoutQuery = withoutPrefix.split('?')[0];
  const path = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}
