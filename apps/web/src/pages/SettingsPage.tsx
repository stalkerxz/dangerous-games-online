import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgeMode, type AgeMode } from '../ageMode';
import { useContent } from '../contentContext';
import { useOnboarding } from '../onboarding';
import { disableDemoMode, enableDemoMode, isDemoModeEnabled, resetDemoData } from '../demoMode';
import { clearDemoRoute, startDemoRoute } from '../demoRoute';
import { usePresentationMode } from '../presentationMode';

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
  const { presentationMode, setPresentationMode } = usePresentationMode();

  const handleResetCache = async () => {
    setResetStatus('Сбрасываем кэш контента…');
    try {
      await resetCache();
      setResetStatus('Кэш контента успешно сброшен.');
    } catch {
      setResetStatus('Не удалось сбросить кэш контента.');
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
      <h2>Настройки</h2>
      <h3>Возрастной режим</h3>
      <p>Выберите, как будут показаны формулировки в кампании и еженедельных миссиях.</p>
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

      <h3>Демо-режим для жюри</h3>
      <p>Заполняет демо-прогресс, улики, достижения и KPI для быстрой презентации проекта.</p>
      <button type="button" onClick={handleToggleDemoMode}>
        {demoModeEnabled ? 'Выключить демо-режим' : 'Включить демо-режим'}
      </button>
      <div className="report-buttons-row">
        <button type="button" onClick={handleStartDemoRoute} disabled={!demoModeEnabled}>
          Запустить демо-маршрут
        </button>
        <button type="button" onClick={handleResetDemoData}>
          Сбросить демо-данные
        </button>
      </div>



      <h3>Режим презентации</h3>
      <p>Более чистый интерфейс для скриншотов и демонстрации без потери функциональности.</p>
      <label className="form-option" htmlFor="presentation-mode-toggle">
        <input
          id="presentation-mode-toggle"
          type="checkbox"
          checked={presentationMode}
          onChange={(event) => setPresentationMode(event.target.checked)}
        />{' '}
        Включить Presentation mode
      </label>

      <h3>Онбординг</h3>
      <p>Нужно повторить вводный квест? Запусти онбординг заново.</p>
      <button type="button" onClick={restartOnboarding}>
        Пройти онбординг снова
      </button>

      <h3>Контент</h3>
      <button type="button" onClick={() => void handleResetCache()} disabled={loading}>
        Сбросить кэш контента
      </button>
      {resetStatus && <p>{resetStatus}</p>}

      {error && (
        <p>
          Синхронизация не удалась: {error}{' '}
          <button type="button" onClick={() => void retrySync()} disabled={loading}>
            Повторить
          </button>
        </p>
      )}

      {import.meta.env.DEV && (
        <>
          <h3>Диагностика контента (только dev)</h3>
          <ul>
            <li>Версия manifest: {diagnostics.manifestVersion ?? 'unknown'}</li>
            <li>Версия campaign-пака: {diagnostics.campaignVersion ?? 'unknown'}</li>
            <li>Источник пакетов: {source === 'network' ? 'network' : 'cache'}</li>
          </ul>
        </>
      )}
    </section>
  );
}
