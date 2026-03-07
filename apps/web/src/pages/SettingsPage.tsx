import { useState } from 'react';
import { useAgeMode, type AgeMode } from '../ageMode';
import { useContent } from '../contentContext';
import { useOnboarding } from '../onboarding';

const options: Array<{ value: AgeMode; label: string; hint: string }> = [
  { value: '8-10', label: '8-10', hint: 'Проще формулировки и короткие подсказки.' },
  { value: '11-14', label: '11-14', hint: 'Более подробные формулировки и контекст.' },
  { value: 'all', label: 'All — Полный чат (демо)', hint: 'Показывает полный чат со всеми эффектами (delay, вложения).' }
];

export function SettingsPage() {
  const { ageMode, setAgeMode } = useAgeMode();
  const { diagnostics, source, loading, error, resetCache, retrySync } = useContent();
  const { restartOnboarding } = useOnboarding();
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  const handleResetCache = async () => {
    setResetStatus('Resetting content cache…');
    try {
      await resetCache();
      setResetStatus('Content cache reset complete.');
    } catch {
      setResetStatus('Failed to reset content cache.');
    }
  };

  return (
    <section>
      <h2>Settings</h2>
      <h3>Age mode</h3>
      <p>Choose how scene text is shown in campaign and weekly missions.</p>
      {options.map((option) => (
        <label key={option.value} style={{ display: 'block', marginBottom: 12 }}>
          <input
            type="radio"
            name="age-mode"
            value={option.value}
            checked={ageMode === option.value}
            onChange={() => setAgeMode(option.value)}
          />{' '}
          <strong>{option.label}</strong> — {option.hint}
        </label>
      ))}


      <h3>Онбординг</h3>
      <p>Нужно повторить вводный квест? Запусти онбординг заново.</p>
      <button type="button" onClick={restartOnboarding}>
        Пройти онбординг снова
      </button>

      <h3>Content</h3>
      <button type="button" onClick={() => void handleResetCache()} disabled={loading}>
        Reset content cache
      </button>
      {resetStatus && <p>{resetStatus}</p>}

      {error && (
        <p>
          Sync failed: {error}{' '}
          <button type="button" onClick={() => void retrySync()} disabled={loading}>
            Retry
          </button>
        </p>
      )}

      {import.meta.env.DEV && (
        <>
          <h3>Content diagnostics (dev only)</h3>
          <ul>
            <li>Manifest version: {diagnostics.manifestVersion ?? 'unknown'}</li>
            <li>Campaign pack version: {diagnostics.campaignVersion ?? 'unknown'}</li>
            <li>Pack source: {source === 'network' ? 'network' : 'cache'}</li>
          </ul>
        </>
      )}
    </section>
  );
}
