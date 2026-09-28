import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/provider';
import type { TanglegramRenderOptions, TreeRenderOptions } from 'phylo-tree-lib';
import { CollapsibleSection } from './CollapsibleSection';

interface CommonSettingsSectionProps {
  isTree: boolean;
  current: TreeRenderOptions | TanglegramRenderOptions;
  onUpdate: (key: string, value: string | number) => void;
}

export function CommonSettingsSection({ current, onUpdate }: CommonSettingsSectionProps) {
  const { t } = useI18n();
  const isTanglegram = 'labelColor' in current;

  return (
    <CollapsibleSection title={t('commonSettings.title')}>
      <div className="control-row">
        <label className="label">{t('commonSettings.branchColor')}</label>
        <DeferredColorInput value={current.branchColor} onCommit={(value) => onUpdate('branchColor', value)} />
      </div>
      <div className="control-row">
        <label className="label">{t('commonSettings.nodeColor')}</label>
        <DeferredColorInput value={current.nodeColor} onCommit={(value) => onUpdate('nodeColor', value)} />
      </div>
      {isTanglegram ? (
        <div className="control-row">
          <label className="label">{t('commonSettings.labelColor')}</label>
          <DeferredColorInput
            value={current.labelColor}
            onCommit={(value) => onUpdate('labelColor', value)}
          />
        </div>
      ) : null}
      <RangeRow
        label={t('commonSettings.branchWidth')}
        value={current.branchWidth}
        min={0.5}
        max={4}
        step={0.1}
        onChange={(value) => onUpdate('branchWidth', value)}
      />
      <RangeRow
        label={t('commonSettings.nodeSize')}
        value={current.nodeSize}
        min={2}
        max={8}
        step={0.5}
        onChange={(value) => onUpdate('nodeSize', value)}
      />
      <RangeRow
        label={t('commonSettings.labelSize')}
        value={current.labelSize}
        min={8}
        max={18}
        step={1}
        onChange={(value) => onUpdate('labelSize', value)}
      />
    </CollapsibleSection>
  );
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commit = () => {
    if (draftValue !== value) {
      onChange(draftValue);
    }
  };

  return (
    <div className="control-row control-row-range">
      <label className="label">{label}</label>
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
    </div>
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
