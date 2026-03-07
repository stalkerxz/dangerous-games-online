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

const skillCards: SkillCard[] = [
  {
    id: 'privacy',
    label: 'Приватность',
    meaning: 'Показывает, насколько уверенно ребёнок защищает личные данные и границы.',
    recommendations: [
      'Обсудите правило: адрес, школа, номер телефона не публикуются в открытых чатах.',
      'Потренируйте фразы отказа, когда просят фото, геолокацию или личные контакты.',
      'Проверьте настройки приватности в играх и мессенджерах вместе.'
    ]
  },
  {
    id: 'account',
    label: 'Безопасность аккаунта',
    meaning: 'Отражает привычки по защите входа, паролей и подозрительных ссылок.',
    recommendations: [
      'Напомните: коды подтверждения и пароли нельзя отправлять никому, даже “админу”.',
      'Включите двухфакторную защиту там, где это возможно.',
      'Создайте семейный чек-лист признаков фишинга перед каждым входом по ссылке.'
    ]
  },
  {
    id: 'antifake',
    label: 'Антифейк',
    meaning: 'Показывает, как ребёнок проверяет правдивость сообщений и “срочных” новостей.',
    recommendations: [
      'Используйте правило двух источников: не верить одному скриншоту или одному каналу.',
      'Разбирайте примеры манипуляций: давление, “только сейчас”, обещание приза.',
      'Перед пересылкой делайте паузу и проверяйте официальный источник.'
    ]
  },
  {
    id: 'communication',
    label: 'Коммуникация',
    meaning: 'Показывает умение спокойно общаться, просить помощь и фиксировать договорённости.',
    recommendations: [
      'Договоритесь о фразе-сигнале, когда нужна помощь взрослого.',
      'Потренируйте вежливое завершение небезопасного диалога.',
      'Обсуждайте сложные переписки без обвинений, через вопросы “что ты почувствовал?”.'
    ]
  },
  {
    id: 'antibullying',
    label: 'Антибуллинг',
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
        strongest: 'n/a (not enough data)',
        weakest: 'n/a (not enough data)'
      };
    }

    const strongest = [...entries].sort((a, b) => b.safeRatio - a.safeRatio)[0].tag;
    const weakest = [...entries].sort((a, b) => a.safeRatio - b.safeRatio)[0].tag;

    return {
      strongest,
      weakest: strongest === weakest ? 'n/a (not enough data)' : weakest
    };
  }, [campaignKpi]);

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
    <section>
      <h2>Parents / Teachers dashboard</h2>
      <p className="section-meta">Краткий отчёт по навыкам и готовые 20-минутные наборы сцен для совместного разбора.</p>

      <h3>Overall KPI summary</h3>
      <p>Scenes completed: {campaignKpi?.overall.scenes_completed_count ?? 0}</p>
      <p>Safe choices: {safeChoices}</p>
      <p>Risky choices: {riskyChoices}</p>
      {safePercent !== null && <p>Percent safe: {safePercent}%</p>}
      <p>Quiz correctness: {campaignKpi?.overall.quiz_correct_count ?? 0}/{campaignKpi?.overall.quiz_total_count ?? 0}</p>
      <p>Final completed: {(campaignKpi?.overall.chapter_final_completed ?? false) ? 'Yes' : 'No'}</p>
      <p>Strongest skill: {skillRanking.strongest}</p>
      <p>Weakest skill: {skillRanking.weakest}</p>

      <button type="button" onClick={() => copyText(shortReportText)}>Copy short report</button>
      <button type="button" onClick={() => copyText(competitionReportText)}>Copy competition report</button>
      {import.meta.env.DEV && (
        <>
          <button type="button" onClick={onLoadDemoData}>Load demo data</button>
          <button type="button" onClick={onClearDemoData}>Clear demo data</button>
        </>
      )}
      {copyState === 'done' && <p className="status-ok">Отчёт скопирован.</p>}
      {copyState === 'error' && <p className="status-error">Не удалось скопировать отчёт.</p>}

      <div className="parents-grid">
        {skillCards.map((skill) => (
          <article key={skill.id} className="skill-card" data-skill={skill.id}>
            <h3>{skill.label}: {progress.skills[skill.id] ?? 0}</h3>
            <p>{skill.meaning}</p>
            <ul>
              {skill.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <h3>20-minute lesson kits</h3>
      <div className="kits-grid">
        {lessonKits.map((kit) => {
          const isCompleted = progress.completedLessonKitIds.includes(kit.id);
          const isFinishedNow = finishedKitId === kit.id;

          return (
            <article key={kit.id} className="kit-card">
              <h4>{kit.title} ({kit.sceneIds.length} scenes)</h4>
              {(isCompleted || isFinishedNow) && <span className="badge">Completed</span>}
              <button
                type="button"
                onClick={() => {
                  setLessonJustCompleted(false);
                  setActiveKitId(kit.id);
                }}
                disabled={!campaign}
              >
                Start lesson
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
