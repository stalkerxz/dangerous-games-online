import { type CSSProperties, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClueDescription, readCluesCollection } from '../cluesCollection';
import { isDemoModeEnabled } from '../demoMode';
import { readDemoRouteState, updateDemoRouteStep } from '../demoRoute';

type ClueMeta = {
  title: string;
  icon: string;
  accent: string;
  explanation: string;
};

const clueMetaMap: Record<string, ClueMeta> = {
  urgency: {
    title: 'Давление и срочность',
    icon: '⏱️',
    accent: '#f97316',
    explanation: 'Учимся распознавать, когда нас торопят ради ошибки.'
  },
  privacy: {
    title: 'Личные данные',
    icon: '🛡️',
    accent: '#22d3ee',
    explanation: 'Тренируем навык не раскрывать чувствительную информацию.'
  },
  account: {
    title: 'Защита аккаунта',
    icon: '🔐',
    accent: '#a78bfa',
    explanation: 'Закрепляем безопасные привычки для входа и паролей.'
  },
  antifake: {
    title: 'Проверка информации',
    icon: '🔎',
    accent: '#facc15',
    explanation: 'Развиваем критичность к фейкам, манипуляциям и “слишком выгодным” новостям.'
  },
  evidence: {
    title: 'Сохранение доказательств',
    icon: '📎',
    accent: '#60a5fa',
    explanation: 'Запоминаем, что скриншоты и фиксация фактов помогают защитить себя.'
  },
  bullying_witness: {
    title: 'Реакция на травлю',
    icon: '🤝',
    accent: '#fb7185',
    explanation: 'Учимся безопасно поддерживать и не усиливать конфликт.'
  },
  antibullying: {
    title: 'Реакция на травлю',
    icon: '🤝',
    accent: '#fb7185',
    explanation: 'Разбираем спокойные и эффективные действия в ситуации травли.'
  },
  communication: {
    title: 'Безопасное общение',
    icon: '💬',
    accent: '#34d399',
    explanation: 'Тренируем уважительное общение и умение вовремя обращаться за помощью.'
  }
};

function formatDate(value: string): string {
  if (!value) {
    return 'нет данных';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'нет данных';
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function CluesPage() {
  const navigate = useNavigate();
  const [demoRouteStep, setDemoRouteStep] = useState(() => readDemoRouteState().step);
  const demoRouteActive = readDemoRouteState().active && isDemoModeEnabled();
  const clues = useMemo(() => readCluesCollection(), []);
  const items = useMemo(
    () => Object.entries(clues).sort((a, b) => b[1].count - a[1].count),
    [clues]
  );

  const knownTypes = Object.keys(clueMetaMap).length;
  const discoveredTypes = items.length;
  const allDiscovered = discoveredTypes >= knownTypes && knownTypes > 0;
  const clueLiteracyPercent = knownTypes === 0 ? 0 : Math.min(100, Math.round((discoveredTypes / knownTypes) * 100));

  return (
    <section className="clues-page">
      <header className="clues-hero">
        <p className="clues-hero-kicker">Коллекция наблюдений</p>
        <h2>Сигналы риска и цифровой грамотности</h2>
        <p className="clues-hero-subtitle">
          Здесь собраны типы риск-сигналов, которые ребёнок уже встречал в сюжетах.
          Эта страница помогает видеть учебный прогресс и повторять навыки перед реальными ситуациями.
        </p>
      </header>

      {demoRouteActive && demoRouteStep === 'clues' && (
        <section className="parents-report-panel" aria-label="Маршрут демо-показа">
          <h3>Маршрут демонстрации</h3>
          <p className="section-meta">Шаг 3/5: Покажите собранные сигналы риска и объясните, как измеряется цифровая грамотность.</p>
          <button
            type="button"
            onClick={() => {
              updateDemoRouteStep('parents');
              setDemoRouteStep('parents');
              navigate('/parents');
            }}
          >
            Далее: панель для родителей и педагогов
          </button>
        </section>
      )}

      <section className="clues-summary" aria-label="Прогресс по уликам">
        <article className="summary-metric">
          <p className="summary-label">Типов уже найдено</p>
          <p className="summary-value">{discoveredTypes} из {knownTypes}</p>
        </article>
        <article className="summary-metric">
          <p className="summary-label">Прогресс к полной грамотности</p>
          <p className="summary-value">{clueLiteracyPercent}%</p>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clueLiteracyPercent}>
            <div className="progress-bar" style={{ width: `${clueLiteracyPercent}%` }} />
          </div>
        </article>
      </section>

      {items.length === 0 && (
        <section className="empty-state" aria-label="Пустое состояние улик">
          <div className="empty-art" aria-hidden>🕵️</div>
          <h3>Коллекция улик ещё пуста</h3>
          <p>Пройдите любую сцену кампании — и здесь появятся первые сигналы риска с примерами.</p>
        </section>
      )}

      {allDiscovered && (
        <section className="completion-state">
          <h3>Коллекция полностью собрана</h3>
          <p>Вы открыли все типы улик. Это показатель зрелой цифровой грамотности.</p>
        </section>
      )}

      {items.length > 0 && (
        <ul className="clues-list">
          {items.map(([clue, entry]) => {
            const meta = clueMetaMap[clue] ?? {
              title: clue,
              icon: '🧩',
              accent: '#64748b',
              explanation: getClueDescription(clue)
            };

            return (
              <li key={clue} className="clue-card clue-card-rich" style={{ '--clue-accent': meta.accent } as CSSProperties}>
                <div className="clue-card-head">
                  <p className="clue-icon" aria-hidden>{meta.icon}</p>
                  <div>
                    <h3>{meta.title}</h3>
                    <p className="section-meta">{meta.explanation}</p>
                  </div>
                  <span className="badge clue-count">{entry.count}</span>
                </div>

                <p className="clue-last-seen">Последний раз замечено: <strong>{formatDate(entry.last_seen)}</strong></p>

                {entry.examples.length > 0 && (
                  <div className="clue-examples">
                    <p>Примеры из сцен</p>
                    <ul>
                      {entry.examples.map((sample) => (
                        <li key={`${clue}-${sample}`}>{sample}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
