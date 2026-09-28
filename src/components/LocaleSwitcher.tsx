import { useI18n } from '../i18n/provider';
import type { Locale } from '../i18n/messages';

const locales: Locale[] = ['ru', 'en'];

interface LocaleSwitcherProps {
  className?: string;
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const { locale, setLocale, localeLabels, t } = useI18n();

  return (
    <div className={className ? `locale-switcher ${className}` : 'locale-switcher'} aria-label={t('locale.label')}>
      {locales.map((entry) => (
        <button
          key={entry}
          type="button"
          className={`locale-switcher-button${locale === entry ? ' locale-switcher-button-active' : ''}`}
          onClick={() => setLocale(entry)}
        >
          {localeLabels[entry]}
        </button>
      ))}
    </div>
  );
}
