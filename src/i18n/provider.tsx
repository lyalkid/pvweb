import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { localeLabels, messages, type Locale } from './messages';

const LOCALE_STORAGE_KEY = 'phylo-viewer-locale';

type MessageKey = string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  localeLabels: Record<Locale, string>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return saved === 'ru' || saved === 'en' ? saved : 'ru';
  });

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback((key: MessageKey, params?: Record<string, string | number>) => {
    const template = resolveMessage(locale, key) ?? resolveMessage('ru', key) ?? key;
    if (!params) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (_, paramKey: string) => {
      const value = params[paramKey];
      return value === undefined ? `{${paramKey}}` : String(value);
    });
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t,
    localeLabels,
  }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}

function resolveMessage(locale: Locale, key: MessageKey): string | null {
  const segments = key.split('.');
  let current: unknown = messages[locale];
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : null;
}
