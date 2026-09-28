import { useI18n } from '../../i18n/provider';
import type { TreeRenderOptions } from 'phylo-tree-lib';
import { CollapsibleSection } from './CollapsibleSection';

interface TreeSettingsSectionProps {
  options: TreeRenderOptions;
  onUpdate: <K extends keyof TreeRenderOptions>(key: K, value: TreeRenderOptions[K]) => void;
}

export function TreeSettingsSection({ options, onUpdate }: TreeSettingsSectionProps) {
  const { t } = useI18n();
  const isCircular = options.mode.startsWith('circular');
  const isPhylogram = options.mode.endsWith('phylogram');

  return (
    <CollapsibleSection title={t('treeSettings.title')}>
      <div className="settings-row">
        <span>{t('treeSettings.treeType')}</span>
        <div className="settings-segment">
          <button
            type="button"
            className={`settings-segment-button${!isPhylogram ? ' settings-segment-button-active' : ''}`}
            onClick={() =>
              onUpdate('mode', isCircular ? 'circular-cladogram' : 'rectangular-cladogram')
            }
          >
            {t('treeSettings.cladogram')}
          </button>
          <button
            type="button"
            className={`settings-segment-button${isPhylogram ? ' settings-segment-button-active' : ''}`}
            onClick={() =>
              onUpdate('mode', isCircular ? 'circular-phylogram' : 'rectangular-phylogram')
            }
          >
            {t('treeSettings.phylogram')}
          </button>
        </div>
      </div>

      <div className="settings-row">
        <span>{t('treeSettings.treeMode')}</span>
        <div className="settings-segment">
          <button
            type="button"
            className={`settings-segment-button${isCircular ? ' settings-segment-button-active' : ''}`}
            onClick={() =>
              onUpdate('mode', isPhylogram ? 'circular-phylogram' : 'circular-cladogram')
            }
          >
            {t('treeSettings.circular')}
          </button>
          <button
            type="button"
            className={`settings-segment-button${!isCircular ? ' settings-segment-button-active' : ''}`}
            onClick={() =>
              onUpdate('mode', isPhylogram ? 'rectangular-phylogram' : 'rectangular-cladogram')
            }
          >
            {t('treeSettings.rectangular')}
          </button>
        </div>
      </div>

      <ToggleRow
        label={t('treeSettings.showLabels')}
        isActive={options.showLabels}
        onToggle={() => onUpdate('showLabels', !options.showLabels)}
      />
      <ToggleRow
        label={t('treeSettings.alignTips')}
        isActive={options.alignTips}
        onToggle={() => onUpdate('alignTips', !options.alignTips)}
      />
      <ToggleRow
        label={t('treeSettings.mirrorTree')}
        isActive={options.mirror}
        onToggle={() => onUpdate('mirror', !options.mirror)}
      />

      {isCircular ? (
        <RangeRow
          label={t('treeSettings.startAngle')}
          value={options.startAngle}
          min={0}
          max={360}
          step={5}
          onChange={(value) => onUpdate('startAngle', value)}
          formatValue={(value) => t('treeSettings.degrees', { value: value.toFixed(0) })}
        />
      ) : null}

      {isCircular ? (
        <RangeRow
          label={t('treeSettings.arcAngle')}
          value={options.arcAngle}
          min={10}
          max={360}
          step={5}
          onChange={(value) => onUpdate('arcAngle', value)}
          formatValue={(value) => t('treeSettings.degrees', { value: value.toFixed(0) })}
        />
      ) : null}

      <RangeRow
        label={t('treeSettings.horizontalSpacing')}
        value={options.layoutSpacingX}
        min={0.5}
        max={3}
        step={0.1}
        disabled={isCircular}
        onChange={(value) => onUpdate('layoutSpacingX', value)}
      />

      <RangeRow
        label={t('treeSettings.verticalSpacing')}
        value={options.layoutSpacingY}
        min={0.5}
        max={3}
        step={0.1}
        disabled={isCircular}
        onChange={(value) => onUpdate('layoutSpacingY', value)}
      />

      {isCircular ? (
        <div className="settings-row">
          <span>{t('treeSettings.spacing')}</span>
          <span>{t('treeSettings.rectangularOnly')}</span>
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

function ToggleRow({
  label,
  isActive,
  onToggle,
}: {
  label: string;
  isActive: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="settings-toggle">
      <span>{label}</span>
      <button
        type="button"
        className={`settings-toggle-button${isActive ? ' settings-toggle-button-active' : ''}`}
        onClick={onToggle}
      >
        {isActive ? t('common.on') : t('common.off')}
      </button>
    </div>
  );
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  disabled = false,
  formatValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="settings-row">
      <span>{label}</span>
      <div className="settings-slider">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span>{formatValue ? formatValue(value) : value.toFixed(1)}</span>
      </div>
    </div>
  );
}
