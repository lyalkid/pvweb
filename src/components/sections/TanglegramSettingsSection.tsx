import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/provider';
import type { TanglegramRenderOptions } from 'phylo-tree-lib';
import { CollapsibleSection } from './CollapsibleSection';

interface TanglegramSettingsSectionProps {
  options: TanglegramRenderOptions;
  onUpdate: <K extends keyof TanglegramRenderOptions>(
    key: K,
    value: TanglegramRenderOptions[K]
  ) => void;
}

export function TanglegramSettingsSection({ options, onUpdate }: TanglegramSettingsSectionProps) {
  const { t } = useI18n();

  return (
    <CollapsibleSection title={t('tanglegramSettings.title')}>
      <div className="control-row control-row-range">
        <label className="label">{t('tanglegramSettings.gap')}</label>
        <DeferredRangeInput min={40} max={1000} step={10} value={options.gap} onCommit={(value) => onUpdate('gap', value)} />
      </div>
      <div className="control-row">
        <label className="label">{t('tanglegramSettings.connectionColor')}</label>
        <DeferredColorInput value={options.connectionColor} onCommit={(value) => onUpdate('connectionColor', value)} />
      </div>
      <div className="control-row control-row-range">
        <label className="label">{t('tanglegramSettings.connectionWidth')}</label>
        <DeferredRangeInput min={0.5} max={4} step={0.1} value={options.connectionWidth} onCommit={(value) => onUpdate('connectionWidth', value)} />
      </div>
      <div className="control-row control-row-range">
        <label className="label">{t('tanglegramSettings.connectionOpacity')}</label>
        <DeferredRangeInput min={0.1} max={1} step={0.05} value={options.connectionOpacity} onCommit={(value) => onUpdate('connectionOpacity', value)} />
      </div>
      <div className="control-row control-row-range">
        <label className="label">{t('tanglegramSettings.connectionCurve')}</label>
        <DeferredRangeInput min={0} max={1} step={0.05} value={options.connectionCurve} onCommit={(value) => onUpdate('connectionCurve', value)} />
      </div>
      <SelectRow
        label={t('tanglegramSettings.connectionVisibility')}
        value={options.connectionVisibility}
        options={[
          ['all', t('tanglegramSettings.visibilityAll')],
          ['selection', t('tanglegramSettings.visibilitySelection')],
          ['focus', t('tanglegramSettings.visibilityFocus')],
        ]}
        onChange={(value) => onUpdate('connectionVisibility', value)}
      />
      <SelectRow
        label={t('tanglegramSettings.connectionDensity')}
        value={options.connectionDensity}
        options={[
          ['all', t('tanglegramSettings.densityAll')],
          ['auto', t('tanglegramSettings.densityAuto')],
          ['sparse', t('tanglegramSettings.densitySparse')],
        ]}
        onChange={(value) => onUpdate('connectionDensity', value)}
      />
      <div className="control-row control-row-range">
        <label className="label">{t('tanglegramSettings.connectionStride')}</label>
        <DeferredRangeInput min={1} max={4} step={0.5} value={options.connectionDensityStrideMultiplier} onCommit={(value) => onUpdate('connectionDensityStrideMultiplier', value)} />
      </div>
      <div className="control-row control-row-range">
        <label className="label">{t('tanglegramSettings.labelGap')}</label>
        <DeferredRangeInput min={0.5} max={3} step={0.1} value={options.labelDensityGapMultiplier} onCommit={(value) => onUpdate('labelDensityGapMultiplier', value)} />
      </div>
    </CollapsibleSection>
  );
}

function DeferredRangeInput({
  min,
  max,
  step,
  value,
  onCommit,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commit = () => {
    if (draftValue !== value) {
      onCommit(draftValue);
    }
  };

  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draftValue}
        onChange={(event) => setDraftValue(Number(event.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
            commit();
          }
        }}
        onBlur={commit}
      />
      <span>{draftValue}</span>
    </>
  );
}

function DeferredColorInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  return (
    <input
      type="color"
      value={draftValue}
      onInput={(event) => setDraftValue((event.target as HTMLInputElement).value)}
      onChange={(event) => onCommit(event.target.value)}
    />
  );
}

function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="control-row">
      <label className="label">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
