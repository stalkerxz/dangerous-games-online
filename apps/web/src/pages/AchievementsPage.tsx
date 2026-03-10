import { useMemo } from 'react';
import { getAchievementViews } from '../achievements';
import { useContent } from '../contentContext';
import { readPlayerProgress } from '../playerProgress';

function getPathTitle(level: number): string {
  if (level >= 7) {
    return 'Кибер-наставник';
  }
  if (level >= 4) {
    return 'Кибер-исследователь';
  }
  return 'Кибер-новичок';
}

export function AchievementsPage() {
  const { achievements } = useContent();

  const items = useMemo(() => getAchievementViews(achievements), [achievements]);
  const unlocked = items.filter((item) => item.unlocked);
  const progress = useMemo(() => readPlayerProgress(), []);

  const skillTotal = Object.values(progress.skills).reduce((sum, value) => sum + value, 0);
  const level = Math.max(1, Math.floor(skillTotal / 3) + 1);
  const title = getPathTitle(level);
  const nextGoalSkillPoints = level * 3;

  return (
    <section className="achievements-page">
      <header className="page-hero page-hero-achievements">
        <p className="page-hero-kicker">Прогресс игрока</p>
        <h2>Мой путь</h2>
        <p className="section-meta">Открывайте трофеи за безопасные решения и устойчивые цифровые навыки.</p>
      </header>

      <section className="clues-summary" aria-label="Путь игрока">
        <article>
          <p className="summary-label">Текущий титул</p>
          <p className="summary-value">{title}</p>
        </article>
        <article>
          <p className="summary-label">Уровень</p>
          <p className="summary-value">{level}</p>
        </article>
        <article>
          <p className="summary-label">Награды</p>
          <p className="summary-value">{progress.badges.length} бейджей</p>
          <p className="section-meta">{progress.badges.slice(0, 3).join(', ') || 'Пока нет — завершите еженедельную миссию.'}</p>
        </article>
        <article>
          <p className="summary-label">Следующая цель</p>
          <p className="summary-value">{skillTotal}/{nextGoalSkillPoints} очков навыков</p>
          <p className="section-meta">Нужно ещё {Math.max(0, nextGoalSkillPoints - skillTotal)} до следующего уровня.</p>
        </article>
      </section>

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
