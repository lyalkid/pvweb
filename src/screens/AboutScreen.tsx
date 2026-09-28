import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { useI18n } from '../i18n/provider';

interface AboutScreenProps {
  onBack: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
  const { t } = useI18n();

  return (
    <div className="screen-shell about-screen">
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="projects-eyebrow">{t('about.eyebrow')}</span>
          <h1>{t('about.title')}</h1>
          <p className="about-hero-text">{t('about.subtitle')}</p>
        </div>
        <div className="about-hero-actions">
          <LocaleSwitcher className="locale-switcher-inline" />
          <button type="button" onClick={onBack}>
            {t('common.backToProjects')}
          </button>
        </div>
      </section>

      <div className="about-grid">
        <section className="about-surface">
          <div className="projects-panel-heading">
            <span className="projects-panel-kicker">{t('about.problemEyebrow')}</span>
            <h3>{t('about.problemTitle')}</h3>
          </div>
          <div className="about-list">
            <div className="about-list-item">
              <strong>{t('about.problemInteractiveTitle')}</strong>
              <p>{t('about.problemInteractiveBody')}</p>
            </div>
            <div className="about-list-item">
              <strong>{t('about.problemStorageTitle')}</strong>
              <p>{t('about.problemStorageBody')}</p>
            </div>
            <div className="about-list-item">
              <strong>{t('about.problemCompareTitle')}</strong>
              <p>{t('about.problemCompareBody')}</p>
            </div>
          </div>
        </section>

        <section className="about-surface">
          <div className="projects-panel-heading">
            <span className="projects-panel-kicker">{t('about.architectureEyebrow')}</span>
            <h3>{t('about.architectureTitle')}</h3>
          </div>
          <div className="about-architecture-stack">
            <article className="about-layer-card">
              <span className="about-layer-index">01</span>
              <div>
                <strong>{t('about.architectureLibraryTitle')}</strong>
                <p>{t('about.architectureLibraryBody')}</p>
              </div>
            </article>
            <article className="about-layer-card">
              <span className="about-layer-index">02</span>
              <div>
                <strong>{t('about.architectureFrontendTitle')}</strong>
                <p>{t('about.architectureFrontendBody')}</p>
              </div>
            </article>
            <article className="about-layer-card">
              <span className="about-layer-index">03</span>
              <div>
                <strong>{t('about.architectureBackendTitle')}</strong>
                <p>{t('about.architectureBackendBody')}</p>
              </div>
            </article>
          </div>
        </section>

        <section className="about-surface">
          <div className="projects-panel-heading">
            <span className="projects-panel-kicker">{t('about.featuresEyebrow')}</span>
            <h3>{t('about.featuresTitle')}</h3>
          </div>
          <div className="about-tags">
            <span>{t('about.featureProjects')}</span>
            <span>{t('about.featureUpload')}</span>
            <span>{t('about.featureSingleViewer')}</span>
            <span>{t('about.featureTanglegramViewer')}</span>
            <span>{t('about.featureStateRestore')}</span>
            <span>{t('about.featureTextEditor')}</span>
            <span>{t('about.featureProjectDocs')}</span>
          </div>
        </section>

        <section className="about-surface">
          <div className="projects-panel-heading">
            <span className="projects-panel-kicker">{t('about.flowEyebrow')}</span>
            <h3>{t('about.flowTitle')}</h3>
          </div>
          <ol className="about-flow">
            <li>{t('about.flowStep1')}</li>
            <li>{t('about.flowStep2')}</li>
            <li>{t('about.flowStep3')}</li>
            <li>{t('about.flowStep4')}</li>
            <li>{t('about.flowStep5')}</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
