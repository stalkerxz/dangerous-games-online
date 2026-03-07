import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgeMode, type AgeMode } from '../ageMode';
import { useContent } from '../contentContext';
import { useOnboarding } from '../onboarding';
import { disableDemoMode, enableDemoMode, isDemoModeEnabled, resetDemoData } from '../demoMode';
import { clearDemoRoute, startDemoRoute } from '../demoRoute';

const options: Array<{ value: AgeMode; label: string; hint: string }> = [
  { value: '8-10', label: '8-10', hint: 'Проще формулировки и короткие подсказки.' },
  { value: '11-14', label: '11-14', hint: 'Более подробные формулировки и контекст.' },
  { value: 'all', label: 'All — Полный чат (демо)', hint: 'Показывает полный чат со всеми эффектами (delay, вложения).' }
];

export function SettingsPage() {
  const navigate = useNavigate();
  const { ageMode, setAgeMode } = useAgeMode();
  const { diagnostics, source, loading, error, achievements, resetCache, retrySync } = useContent();
  const { restartOnboarding } = useOnboarding();
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [demoModeEnabled, setDemoModeEnabled] = useState(() => isDemoModeEnabled());

  const handleResetCache = async () => {
    setResetStatus('Resetting content cache…');
    try {
      await resetCache();
      setResetStatus('Content cache reset complete.');
    } catch {
      setResetStatus('Failed to reset content cache.');
    }
  };

  const handleToggleDemoMode = () => {
    if (!demoModeEnabled) {
      const achievementIds = (achievements?.items ?? []).slice(0, 3).map((item) => item.id);
      enableDemoMode(ageMode, achievementIds);
      setDemoModeEnabled(true);
      return;
    }

    disableDemoMode();
    clearDemoRoute();
    setDemoModeEnabled(false);
  };

  const handleStartDemoRoute = () => {
    startDemoRoute();
    navigate('/campaign');
  };

  const handleResetDemoData = () => {
    const shouldDropAll = window.confirm(
      'Удалить весь локальный прогресс без восстановления? Нажмите OK для полного сброса. Cancel вернет обычный режим с восстановлением из бэкапа.'
    );

    resetDemoData({ dropAllProgress: shouldDropAll });
    clearDemoRoute();
    setDemoModeEnabled(false);
  };

  return (
    <section>
      <h2>Settings</h2>
      <h3>Age mode</h3>
      <p>Choose how scene text is shown in campaign and weekly missions.</p>
      {options.map((option) => (
        <label key={option.value} className="form-option">
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

      <h3>Demo mode / Jury mode</h3>
      <p>Быстрый режим презентации: заполнит демо-прогресс, улики, достижения и KPI без ручной подготовки.</p>
      <button type="button" onClick={handleToggleDemoMode}>
        {demoModeEnabled ? 'Disable demo mode' : 'Enable demo mode'}
      </button>
      <div className="report-buttons-row">
        <button type="button" onClick={handleStartDemoRoute} disabled={!demoModeEnabled}>
          Start demo route
        </button>
        <button type="button" onClick={handleResetDemoData}>
          Reset demo data
        </button>
      </div>

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
