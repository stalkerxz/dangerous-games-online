import { useMemo } from 'react';
import { getAchievementViews } from '../achievements';
import { useContent } from '../contentContext';

export function AchievementsPage() {
  const { achievements } = useContent();

  const items = useMemo(() => getAchievementViews(achievements), [achievements]);
  const unlocked = items.filter((item) => item.unlocked);

  return (
    <section className="achievements-page">
      <header className="page-hero page-hero-achievements">
        <p className="page-hero-kicker">Прогресс игрока</p>
        <h2>Достижения</h2>
        <p className="section-meta">Открывайте трофеи за безопасные решения и устойчивые цифровые навыки.</p>
      </header>

      {items.length === 0 && (
        <section className="empty-state" aria-label="Пустое состояние достижений">
          <div className="empty-art" aria-hidden>🏆</div>
          <h3>Пока нет доступного набора достижений</h3>
          <p>Один раз подключитесь к сети, чтобы загрузить пак достижений и включить отслеживание прогресса.</p>
        </section>
      )}

      {items.length > 0 && (
        <>
          <section className="clues-summary" aria-label="Сводка достижений">
            <article>
              <p className="summary-label">Открыто достижений</p>
              <p className="summary-value">{unlocked.length} из {items.length}</p>
            </article>
            <article>
              <p className="summary-label">Готово к финалу</p>
              <p className="summary-value">{unlocked.length === items.length ? 'Да' : 'Ещё в процессе'}</p>
            </article>
          </section>

          <ul className="clues-list">
            {items.map((item) => (
              <li key={item.id} className={`achievement-card${item.unlocked ? ' is-unlocked' : ''}`}>
                <div>
                  <h3>{item.icon} {item.name}</h3>
                  <p className="section-meta">{item.description}</p>
                </div>
                <p className={`status-pill ${item.unlocked ? 'safe' : 'neutral'}`}>
                  {item.unlocked ? 'Открыто' : 'В процессе'}
                </p>
                <p className="achievement-progress">Прогресс: {item.progress}/{item.target}</p>
                {item.unlocked && <p className="completion-note">✨ Достижение разблокировано — отличный результат!</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
