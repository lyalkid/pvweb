import { useCallback, useEffect, useState } from 'react';
import { parseRoute, routeToHash, type RouteState } from '../app/routes';

interface UseRouteStateResult {
  route: RouteState;
  navigate: (next: RouteState, replace?: boolean) => void;
}

export function useRouteState(): UseRouteStateResult {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.hash));

  const navigate = useCallback((next: RouteState, replace = false) => {
    const hash = routeToHash(next);
    const url = `${window.location.pathname}${window.location.search}${hash}`;

    if (replace) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
    setRoute(next);
  }, []);

  useEffect(() => {
    function syncFromLocation() {
      setRoute(parseRoute(window.location.hash));
    }

    // hashchange нужен для правки адреса вручную, popstate — для кнопок «назад» и «вперёд».
    window.addEventListener('hashchange', syncFromLocation);
    window.addEventListener('popstate', syncFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncFromLocation);
      window.removeEventListener('popstate', syncFromLocation);
    };
  }, []);

  return { route, navigate };
}
