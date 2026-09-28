import { useCallback, useMemo, useState } from 'react';
import {
  defaultTanglegramRenderOptions,
  defaultTreeRenderOptions,
  type TanglegramRenderOptions,
  type TreeRenderOptions,
} from 'phylo-tree-lib';

export type AppMode = 'tree' | 'tanglegram';
export type AppTheme = 'light' | 'dark';

export interface ViewerCommands {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  exportSvg: (fileName: string) => void;
  exportPng: (fileName: string) => Promise<void>;
}

interface ViewerSettingsState {
  tree: TreeRenderOptions;
  tanglegram: TanglegramRenderOptions;
  updateTree: <K extends keyof TreeRenderOptions>(key: K, value: TreeRenderOptions[K]) => void;
  updateTanglegram: <K extends keyof TanglegramRenderOptions>(
    key: K,
    value: TanglegramRenderOptions[K]
  ) => void;
  replaceTree: (options: TreeRenderOptions) => void;
  replaceTanglegram: (options: TanglegramRenderOptions) => void;
}

export interface AppModel {
  layout: {
    mode: AppMode;
    theme: AppTheme;
    menuOpen: boolean;
  };
  settings: ViewerSettingsState;
  actions: {
    setMode: (mode: AppMode) => void;
    toggleTheme: () => void;
    toggleMenu: () => void;
  };
}

export function useAppModel(): AppModel {
  const [mode, setMode] = useState<AppMode>('tree');
  const [theme, setTheme] = useState<AppTheme>('light');
  const [menuOpen, setMenuOpen] = useState(false);

  const [treeOptions, setTreeOptions] = useState<TreeRenderOptions>(() => ({
    ...defaultTreeRenderOptions(),
    width: 1440,
    height: 900,
  }));
  const [tanglegramOptions, setTanglegramOptions] = useState<TanglegramRenderOptions>(() => ({
    ...defaultTanglegramRenderOptions(),
    width: 1440,
    height: 900,
  }));

  const updateTree = useCallback(
    <K extends keyof TreeRenderOptions>(key: K, value: TreeRenderOptions[K]) => {
      setTreeOptions((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const updateTanglegram = useCallback(
    <K extends keyof TanglegramRenderOptions>(key: K, value: TanglegramRenderOptions[K]) => {
      setTanglegramOptions((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const replaceTree = useCallback((options: TreeRenderOptions) => {
    setTreeOptions(options);
  }, []);

  const replaceTanglegram = useCallback((options: TanglegramRenderOptions) => {
    setTanglegramOptions(options);
  }, []);

  const actions = useMemo(
    () => ({
      setMode,
      toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
      toggleMenu: () => setMenuOpen((current) => !current),
    }),
    []
  );

  return {
    layout: { mode, theme, menuOpen },
    settings: {
      tree: treeOptions,
      tanglegram: tanglegramOptions,
      updateTree,
      updateTanglegram,
      replaceTree,
      replaceTanglegram,
    },
    actions,
  };
}
