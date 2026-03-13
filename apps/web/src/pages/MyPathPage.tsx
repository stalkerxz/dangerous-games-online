import { useMemo } from 'react';
import { useContent } from '../contentContext';
import { readCampaignKpiProgress, readCampaignProgress, readPlayerProgress } from '../playerProgress';
import { readCluesCollection } from '../cluesCollection';
import { useAgeMode } from '../ageMode';
import { calculateProgressSummary } from '../progression';

const districtNames: Record<string, string> = {
  'chapter-chats': 'Школа',
  'chapter-social': 'Соцсети',
  'chapter-games': 'Игровой клуб',
  'chapter-fakes': 'Новости и фейки',
  'chapter-cyberbullying': 'Давление и травля'
};

export function MyPathPage() {
  const { campaign } = useContent();
  const { ageMode } = useAgeMode();

  const campaignProgress = readCampaignProgress();
  const modeProgress = campaignProgress[ageMode] ?? { completedScenes: {}, completedFinals: {}, completedMiniTasks: {} };
  const campaignKpi = readCampaignKpiProgress()[ageMode];
  const clues = readCluesCollection();
  const playerProgress = readPlayerProgress();

  const summary = useMemo(
    () => calculateProgressSummary(modeProgress, campaign?.chapters ?? [], clues, campaignKpi?.overall.safe_choices_count ?? 0),
    [modeProgress, campaign, clues, campaignKpi]
  );

  const strongestSkills = Object.entries(playerProgress.skills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const nextDistrict = (campaign?.chapters ?? []).find((chapter) => !modeProgress.completedFinals[chapter.id]);

  return (
    <section className="clues-page">
      <header className="clues-hero">
        <p className="clues-hero-kicker">Мотивация и рост</p>
        <h2>Мой путь</h2>
        <p className="clues-hero-subtitle">Твой прогресс по цифровой безопасности: уровень, навыки и открытые награды районов.</p>
      </header>

      <section className="clues-summary">
        <article>
          <p className="summary-label">Текущий уровень</p>
          <p className="summary-value">{summary.level}. {summary.title}</p>
          <p className="section-meta">Очки прогресса: {summary.score}</p>
        </article>
        <article>
          <p className="summary-label">До следующего звания</p>
          <p className="summary-value">{summary.nextTitle ?? 'Максимум достигнут'}</p>
          <div className="progress"><div className="progress-bar" style={{ width: `${summary.progressToNext}%` }} /></div>
        </article>
      </section>

      <section className="parents-report-panel">
        <h3>Обнаруженные типы улик</h3>
        <p className="section-meta">{Object.keys(clues).length} типов</p>
      </section>

      <section className="parents-report-panel">
        <h3>Открытые награды районов</h3>
        <div className="chip-row">
          {summary.unlockedDistrictRewards.length === 0 && <span className="section-meta">Пока нет. Заверши финал района, чтобы открыть знак.</span>}
          {summary.unlockedDistrictRewards.map((districtId) => (
            <span className="clue-chip" key={districtId}>🏅 {districtNames[districtId] ?? districtId}</span>
          ))}
        </div>
      </section>

      <section className="parents-report-panel">
        <h3>Сильные навыки</h3>
        <ul>
          {strongestSkills.length === 0 && <li>Пока нет данных навыков.</li>}
          {strongestSkills.map(([skill, score]) => <li key={skill}>{skill}: {score}</li>)}
        </ul>
      </section>

      <section className="parents-report-panel">
        <h3>Рекомендованный следующий район</h3>
        <p>{nextDistrict ? `Дальше лучше пройти: ${districtNames[nextDistrict.id] ?? nextDistrict.title}` : 'Все районы пройдены. Можно повторить сложные кейсы.'}</p>
      </section>
    </section>
  );
}
