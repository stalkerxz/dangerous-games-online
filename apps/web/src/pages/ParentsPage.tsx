import { useMemo, useState } from 'react';
import { ScenePlayer } from '../components/ScenePlayer';
import { useContent } from '../contentContext';
import type { StoryScene } from '../contentEngine';
import { completeLessonKit, clearParentsDemoData, readCampaignKpiProgress, readPlayerProgress, seedParentsDemoData } from '../playerProgress';
import { useAgeMode } from '../ageMode';
import { clearAchievementProgress, getAchievementViews, seedDemoAchievements } from '../achievements';

type SkillCard = {
  id: 'privacy' | 'account' | 'antifake' | 'communication' | 'antibullying';
  label: string;
  meaning: string;
  recommendations: string[];
};

type LessonKit = {
  id: string;
  title: string;
  sceneIds: string[];
};

const readableTagLabels: Record<string, string> = {
  urgency: 'Давление и срочность',
  privacy: 'Личные данные',
  account: 'Защита аккаунта',
  antifake: 'Проверка информации',
  bullying_witness: 'Реакция на травлю',
  antibullying: 'Реакция на травлю',
  communication: 'Безопасное общение'
};

const skillCards: SkillCard[] = [
  {
    id: 'privacy',
    label: 'Личные данные',
    meaning: 'Насколько уверенно ребёнок защищает персональную информацию и личные границы.',
    recommendations: [
      'Обсудите правило: адрес, школа, номер телефона не публикуются в открытых чатах.',
      'Потренируйте фразы отказа, когда просят фото, геолокацию или личные контакты.',
      'Проверьте настройки приватности в играх и мессенджерах вместе.'
    ]
  },
  {
    id: 'account',
    label: 'Защита аккаунта',
    meaning: 'Показывает привычки по защите входа, паролей и подозрительных ссылок.',
    recommendations: [
      'Напомните: коды подтверждения и пароли нельзя отправлять никому, даже “админу”.',
      'Включите двухфакторную защиту там, где это возможно.',
      'Создайте семейный чек-лист признаков фишинга перед каждым входом по ссылке.'
    ]
  },
  {
    id: 'antifake',
    label: 'Проверка информации',
    meaning: 'Показывает, как ребёнок проверяет правдивость сообщений и “срочных” новостей.',
    recommendations: [
      'Используйте правило двух источников: не верить одному скриншоту или одному каналу.',
      'Разбирайте примеры манипуляций: давление, “только сейчас”, обещание приза.',
      'Перед пересылкой делайте паузу и проверяйте официальный источник.'
    ]
  },
  {
    id: 'communication',
    label: 'Безопасное общение',
    meaning: 'Показывает умение спокойно общаться, просить помощь и фиксировать договорённости.',
    recommendations: [
      'Договоритесь о фразе-сигнале, когда нужна помощь взрослого.',
      'Потренируйте вежливое завершение небезопасного диалога.',
      'Обсуждайте сложные переписки без обвинений, через вопросы “что ты почувствовал?”.'
    ]
  },
  {
    id: 'antibullying',
    label: 'Реакция на травлю',
    meaning: 'Отражает навыки реагирования на травлю, поддержку свидетеля и сохранение доказательств.',
    recommendations: [
      'Повторите алгоритм: не отвечать агрессией, сохранить скриншоты, сообщить взрослому.',
      'Покажите, как безопасно поддержать жертву как свидетель.',
      'Назначьте взрослых, к которым ребёнок может обратиться в школе и дома.'
    ]
  }
];

const lessonKits: LessonKit[] = [
  {
    id: 'kit-privacy',
    title: 'Приватность',
    sceneIds: ['chats-geolocation', 'chats-evidence-trade', 'chats-final-checklist', 'chats-sms-code']
  },
  {
    id: 'kit-antifake',
    title: 'Антифейк',
    sceneIds: ['chats-prize-link', 'chats-second-channel', 'chats-evidence-fake-support', 'chats-pressure-admin']
  },
  {
    id: 'kit-cyberbullying',
    title: 'Кибербуллинг',
    sceneIds: ['chats-bullying-proof', 'chats-evidence-trade', 'chats-evidence-fake-support', 'chats-final-checklist']
  }
];

function toReadableSkillName(value: string): string {
  return readableTagLabels[value] ?? value;
}

export function ParentsPage() {
  const { campaign, achievements, loading } = useContent();
  const { ageMode } = useAgeMode();
  const [progress, setProgress] = useState(() => readPlayerProgress());
  const [activeKitId, setActiveKitId] = useState<string | null>(null);
  const [finishedKitId, setFinishedKitId] = useState<string | null>(null);
  const [lessonJustCompleted, setLessonJustCompleted] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');

  const activeKit = lessonKits.find((kit) => kit.id === activeKitId) ?? null;

  const activeScenes = useMemo<StoryScene[]>(() => {
    if (!campaign || !activeKit) {
      return [];
    }

    return activeKit.sceneIds
      .map((sceneId) => campaign.scenes.find((scene) => scene.id === sceneId))
      .filter((scene): scene is StoryScene => scene !== undefined);
  }, [activeKit, campaign]);

  const campaignKpi = readCampaignKpiProgress()[ageMode];
  const achievementViews = getAchievementViews(achievements);
  const unlockedAchievementsCount = achievementViews.filter((item) => item.unlocked).length;

  const safeChoices = campaignKpi?.overall.safe_choices_count ?? 0;
  const riskyChoices = campaignKpi?.overall.risky_choices_count ?? 0;
  const totalChoices = safeChoices + riskyChoices;
  const safePercent = totalChoices > 0 ? Math.round((safeChoices / totalChoices) * 100) : null;

  const skillRanking = useMemo(() => {
    const tagTotals = campaignKpi?.overall.tag_totals ?? {};
    const tagSafeCounts = campaignKpi?.overall.tag_safe_counts ?? {};
    const entries = Object.entries(tagTotals)
      .filter(([, total]) => total > 0)
      .map(([tag, total]) => ({ tag, total, safeRatio: (tagSafeCounts[tag] ?? 0) / total }));

    const totalTaggedEvents = entries.reduce((acc, item) => acc + item.total, 0);

    if (totalTaggedEvents < 5 || entries.length <= 1) {
      return {
        strongest: 'Недостаточно данных',
        weakest: 'Недостаточно данных'
      };
    }

    const strongest = [...entries].sort((a, b) => b.safeRatio - a.safeRatio)[0].tag;
    const weakest = [...entries].sort((a, b) => a.safeRatio - b.safeRatio)[0].tag;

    return {
      strongest: toReadableSkillName(strongest),
      weakest: strongest === weakest ? 'Недостаточно данных' : toReadableSkillName(weakest)
    };
  }, [campaignKpi]);

  const weakSkillCard = useMemo(
    () => skillCards.find((card) => card.label === skillRanking.weakest) ?? skillCards[0],
    [skillRanking.weakest]
  );

  const shortReportText = useMemo(() => {
    const lines = [
      'Parents KPI short report (no personal data)',
      `Age mode: ${ageMode}`,
      `Scenes completed: ${campaignKpi?.overall.scenes_completed_count ?? 0}`,
      `Safe choices: ${safeChoices} | Risky choices: ${riskyChoices}${safePercent === null ? '' : ` | Safe rate: ${safePercent}%`}`,
      `Quiz correctness: ${campaignKpi?.overall.quiz_correct_count ?? 0}/${campaignKpi?.overall.quiz_total_count ?? 0}`,
      `Final completed: ${(campaignKpi?.overall.chapter_final_completed ?? false) ? 'Yes' : 'No'}`,
      `Strongest/weakest: ${skillRanking.strongest} / ${skillRanking.weakest}`
    ];

    return lines.join('\n');
  }, [ageMode, campaignKpi, riskyChoices, safeChoices, safePercent, skillRanking]);

  const competitionReportText = useMemo(() => {
    const lines = [
      'Competition KPI report (offline, no personal data)',
      `Age mode: ${ageMode}`,
      `Scenes completed: ${campaignKpi?.overall.scenes_completed_count ?? 0}`,
      `Safe choices: ${safeChoices}`,
      `Risky choices: ${riskyChoices}`,
      `Quiz correctness: ${campaignKpi?.overall.quiz_correct_count ?? 0}/${campaignKpi?.overall.quiz_total_count ?? 0}`,
      `Final chapter completed: ${(campaignKpi?.overall.chapter_final_completed ?? false) ? 'Yes' : 'No'}`,
      `Achievements unlocked: ${unlockedAchievementsCount}`,
      `Lesson kits completed: ${progress.completedLessonKitIds.length}/${lessonKits.length}`,
      `Strongest skill: ${skillRanking.strongest}`,
      `Weakest skill: ${skillRanking.weakest}`
    ];

    return lines.join('\n');
  }, [
    ageMode,
    campaignKpi,
    progress.completedLessonKitIds.length,
    riskyChoices,
    safeChoices,
    skillRanking.strongest,
    skillRanking.weakest,
    unlockedAchievementsCount
  ]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  };

  const onLessonComplete = () => {
    if (!activeKitId) {
      return;
    }

    setProgress(completeLessonKit(activeKitId));
    setFinishedKitId(activeKitId);
    setLessonJustCompleted(true);
  };

  const onLoadDemoData = () => {
    const result = seedParentsDemoData(ageMode);
    const unlockIds = (achievements?.items ?? []).slice(0, 2).map((item) => item.id);
    seedDemoAchievements(unlockIds);
    setProgress(result.playerProgress);
  };

  const onClearDemoData = () => {
    clearParentsDemoData();
    clearAchievementProgress();
    setProgress(readPlayerProgress());
  };

  if (loading) {
    return <section><h2>Parents / Teachers</h2><p>Загружаем отчёт…</p></section>;
  }

  if (activeKit && lessonJustCompleted) {
    return (
      <section>
        <h2>Урок завершён</h2>
        <p>Набор «{activeKit.title}» пройден. Можно вернуться к отчёту или запустить другой урок.</p>
        <button
          type="button"
          onClick={() => {
            setActiveKitId(null);
            setLessonJustCompleted(false);
          }}
        >
          Вернуться к дашборду
        </button>
      </section>
    );
  }

  if (activeKit && activeScenes.length > 0) {
    return (
      <section>
        <h2>Урок: {activeKit.title}</h2>
        <ScenePlayer
          title={`20-минутный набор: ${activeKit.title}`}
          scenes={activeScenes}
          onComplete={onLessonComplete}
          showSceneProgress
        />
      </section>
    );
  }

  return (
    <section className="parents-page">
      <h2>Панель для родителей и наставников</h2>
      <p className="section-meta">Краткий отчёт по навыкам и готовые 20-минутные наборы сцен для совместного разбора.</p>

      <article className="parents-summary-card">
        <div>
          <p className="summary-label">Пройдено сцен</p>
          <p className="summary-value">{campaignKpi?.overall.scenes_completed_count ?? 0}</p>
        </div>
        <div>
          <p className="summary-label">Самый устойчивый навык</p>
          <p className="summary-value summary-skill">{skillRanking.strongest}</p>
        </div>
        <div>
          <p className="summary-label">Зона роста</p>
          <p className="summary-value summary-skill">{skillRanking.weakest}</p>
        </div>
        <button
          type="button"
          className="recommendation-cta"
          onClick={() => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          Смотреть рекомендацию
        </button>
      </article>

      <section className="parents-report-panel" aria-label="Экспорт отчётов">
        <h3>Отчёты для конкурса</h3>
        <p className="section-meta">Без персональных данных: только агрегированные KPI.</p>
        <div className="report-buttons-row">
          <button type="button" className="report-button" onClick={() => copyText(shortReportText)}>Короткий отчёт</button>
          <button type="button" className="report-button report-button-emphasis" onClick={() => copyText(competitionReportText)}>Отчёт для конкурса</button>
          {import.meta.env.DEV && (
            <>
              <button type="button" onClick={onLoadDemoData}>Load demo data</button>
              <button type="button" onClick={onClearDemoData}>Clear demo data</button>
            </>
          )}
        </div>
        {copyState === 'done' && <p className="status-ok">Отчёт скопирован.</p>}
        {copyState === 'error' && <p className="status-error">Не удалось скопировать отчёт.</p>}
      </section>

      <div className="parents-grid">
        {skillCards.map((skill) => {
          const score = progress.skills[skill.id] ?? 0;
          const visualPercent = Math.min(100, score * 10);

          return (
            <article key={skill.id} className="skill-card skill-card-rich" data-skill={skill.id}>
              <header>
                <h3>{skill.label}</h3>
                <p className="skill-score">{score} балл(ов)</p>
              </header>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={visualPercent}>
                <div className="progress-bar" style={{ width: `${visualPercent}%` }} />
              </div>
              <p>{skill.meaning}</p>
              <ul>
                {skill.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <section id="recommendations" className="recommendation-card">
        <h3>Рекомендация на ближайшую неделю</h3>
        <p>
          Сфокусируйтесь на навыке <strong>{weakSkillCard.label}</strong>: начните с 1 короткого разбора переписки
          и закрепите алгоритм действия в безопасном диалоге.
        </p>
        <ul>
          {weakSkillCard.recommendations.slice(0, 2).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <h3>20-минутные наборы сцен</h3>
      <div className="kits-grid">
        {lessonKits.map((kit) => {
          const isCompleted = progress.completedLessonKitIds.includes(kit.id);
          const isFinishedNow = finishedKitId === kit.id;

          return (
            <article key={kit.id} className="kit-card">
              <h4>{kit.title} ({kit.sceneIds.length} сцен)</h4>
              {(isCompleted || isFinishedNow) && <span className="badge">Пройдено</span>}
              <button
                type="button"
                onClick={() => {
                  setLessonJustCompleted(false);
                  setActiveKitId(kit.id);
                }}
                disabled={!campaign}
              >
                Начать урок
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
