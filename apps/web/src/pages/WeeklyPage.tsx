import { useMemo, useState } from 'react';
import { ScenePlayer } from '../components/ScenePlayer';
import { useContent } from '../contentContext';
import { completeWeeklyMission, readPlayerProgress } from '../playerProgress';
import { processAchievementEvent, type GameEvent } from '../achievements';
import { useAgeMode } from '../ageMode';

function isBetweenInclusive(today: string, start: string, end: string) {
  return today >= start && today <= end;
}

export function WeeklyPage() {
  const { weeklyPacks, achievements, loading, error, retrySync } = useContent();
  const { ageMode } = useAgeMode();
  const [progress, setProgress] = useState(() => readPlayerProgress());
  const today = new Date().toISOString().slice(0, 10);

  const sortedWeekly = useMemo(
    () => [...weeklyPacks].sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [weeklyPacks]
  );

  const activeWeekly = sortedWeekly.find((pack) => isBetweenInclusive(today, pack.start_date, pack.end_date)) ?? null;
  const nextWeekly = sortedWeekly
    .filter((pack) => pack.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null;

  const onComplete = () => {
    if (!activeWeekly) {
      return;
    }

    const result = completeWeeklyMission(activeWeekly.id, activeWeekly.rewards);
    setProgress(result.progress);

    if (result.updated) {
      for (const [skill, level] of Object.entries(result.progress.skills)) {
        processAchievementEvent(achievements, { type: 'skill_changed', payload: { skill, level } });
      }
    }
  };

  const onEvent = (event: GameEvent) => {
    processAchievementEvent(achievements, event);
  };

  const isActiveCompleted = activeWeekly ? progress.completedWeeklyIds.includes(activeWeekly.id) : false;

  return (
    <section className="weekly-page">
      <header className="page-hero page-hero-weekly">
        <p className="page-hero-kicker">Еженедельный ритм</p>
        <h2>Еженедельные миссии</h2>
        <p className="section-meta">Короткие сценарии для классных часов и домашней практики: навык закрепляется небольшими шагами каждую неделю.</p>
      </header>

      {!activeWeekly && nextWeekly && (
        <section className="empty-state" aria-label="Следующая миссия">
          <div className="empty-art" aria-hidden>📅</div>
          <h3>Новая миссия уже на подходе</h3>
          <p>{nextWeekly.title} · {nextWeekly.start_date} — {nextWeekly.end_date}</p>
        </section>
      )}

      {!activeWeekly && !nextWeekly && (
        <section className="empty-state" aria-label="Пустое состояние недели">
          <div className="empty-art" aria-hidden>🛰️</div>
          <h3>Пока нет активной еженедельной миссии</h3>
          <p>Проверьте позже — новые миссии появятся в следующем обновлении контента.</p>
        </section>
      )}

      {activeWeekly && isActiveCompleted && (
        <section className="completion-state">
          <h3>Миссия недели выполнена</h3>
          <p>Отличная работа! Награда начислена, а прогресс сохранён в профиле.</p>
        </section>
      )}

      {activeWeekly && !isActiveCompleted && (
        <>
          <p className="section-meta">Активна сейчас: {activeWeekly.start_date} — {activeWeekly.end_date}</p>
          <ScenePlayer
            title={activeWeekly.title}
            scenes={activeWeekly.scenes}
            startSceneId={activeWeekly.start_scene}
            ageMode={ageMode}
            onComplete={onComplete}
            onEvent={onEvent}
            eventContext={{ weeklyId: activeWeekly.id }}
            footer={(
              <p>
                Награда: бейдж <strong>{activeWeekly.rewards.badge}</strong>, навыки{' '}
                {Object.entries(activeWeekly.rewards.skills)
                  .map(([key, value]) => `${key} +${value}`)
                  .join(', ')}
              </p>
            )}
          />
        </>
      )}

      <h3>Архив миссий</h3>

      {error && (
        <p>
          Не удалось обновить еженедельные задания: {error}{' '}
          <button type="button" onClick={() => void retrySync()} disabled={loading}>Повторить</button>
        </p>
      )}

      {loading && <p>Загружаем архив еженедельных заданий…</p>}
      {!loading && sortedWeekly.length === 0 && <p>Локально пока нет загруженных материалов недели.</p>}
      {!loading && sortedWeekly.length > 0 && (
        <ul>
          {sortedWeekly.map((pack) => (
            <li key={pack.id}>
              {pack.title} ({pack.start_date} — {pack.end_date})
              {progress.completedWeeklyIds.includes(pack.id) ? ' ✅ Выполнено' : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
