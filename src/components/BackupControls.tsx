import { useRef, useState } from 'react';
import { downloadBackup, exportBackup, importBackup, parseBackup } from '../lib/backup';
import { useI18n } from '../i18n/provider';
import { getErrorMessage } from '../utils/errors';

interface BackupControlsProps {
  onImported: () => void;
}

/**
 * Выгрузка и загрузка резервной копии.
 *
 * Данные лежат в браузере, поэтому копия — единственный способ их сохранить
 * при очистке данных сайта и перенести на другой компьютер.
 */
export function BackupControls({ onImported }: BackupControlsProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      downloadBackup(await exportBackup());
      setMessage({ tone: 'success', text: t('backup.exportDone') });
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error, t('backup.exportFailed')) });
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const payload = parseBackup(await file.text());
      const summary = t('backup.confirmImport', { count: payload.projects.length });
      if (!window.confirm(summary)) {
        return;
      }
      await importBackup(payload);
      setMessage({ tone: 'success', text: t('backup.importDone') });
      onImported();
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error, t('backup.importFailed')) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backup-controls">
      <button type="button" disabled={busy} onClick={() => void handleExport()}>
        {t('backup.export')}
      </button>
      <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
        {t('backup.import')}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            void handleImportFile(file);
          }
        }}
      />
      {message ? (
        <span className={message.tone === 'error' ? 'error' : 'hint'}>{message.text}</span>
      ) : null}
    </div>
  );
}
