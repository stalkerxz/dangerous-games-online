import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScenePlayer } from '../components/ScenePlayer';
import { useContent } from '../contentContext';
import type { StoryScene } from '../contentEngine';
import { completeLessonKit, readCampaignKpiProgress, readPlayerProgress } from '../playerProgress';
import { useAgeMode } from '../ageMode';
import { getAchievementViews } from '../achievements';
import { isDemoModeEnabled } from '../demoMode';
import { readDemoRouteState, updateDemoRouteStep } from '../demoRoute';
import { readCluesCollection } from '../cluesCollection';

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

type TeacherLesson = {
  id: 'class-hour' | 'prevention' | 'home-talk';
  title: string;
  duration: string;
  sceneIds: string[];
  goal: string;
  discussion: string;
  skill: string;
  watchout: string;
  intro: string;
  debriefPrompt: string;
  nextStep: string;
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

const lessonModeEntries: TeacherLesson[] = [
  {
    id: 'class-hour',
    title: 'Классный час',
    duration: '10 минут',
    sceneIds: ['chats-prize-link', 'chats-pressure-admin'],
    goal: 'Научиться не поддаваться на «срочные» сообщения и проверять источник через взрослого или официальный канал.',
    discussion: 'Какие слова давления заметили и как можно остановиться перед ответом в школьном чате?',
    skill: 'Проверка информации и безопасное решение под давлением.',
    watchout: 'Импульсивные ответы и доверие к «админу» без проверки аккаунта.',
    intro: 'Короткая сессия для класса: распознаём фейковый приз и тренируем алгоритм проверки.',
    debriefPrompt: 'Какой один сигнал риска вы теперь точно узнаете в школьном чате?',
    nextStep: 'Следующий урок: «Профилактика (15 минут)» или глава «Безопасность аккаунта» в кампании.'
  },
  {
    id: 'prevention',
    title: 'Профилактика',
    duration: '15 минут',
    sceneIds: ['chats-second-channel', 'chats-sms-code'],
    goal: 'Закрепить профилактический алгоритм: не передавать коды, проверять через второй канал и звать взрослого.',
    discussion: 'Какие действия действительно защищают аккаунт, а какие только выглядят «быстрым решением»?',
    skill: 'Защита аккаунта и устойчивость к социальной инженерии.',
    watchout: 'Передача кодов, переход по спешным ссылкам и страх «потерять аккаунт».',
    intro: 'Практика для профилактики: один кейс на проверку источника и одна мини-задача на безопасный ответ.',
    debriefPrompt: 'Какой шаг из алгоритма защиты аккаунта вы примените сегодня первым?',
    nextStep: 'Следующий урок: «Разговор дома (7 минут)» или повтор сцены «chats-final-checklist».'
  },
  {
    id: 'home-talk',
    title: 'Разговор дома',
    duration: '7 минут',
    sceneIds: ['chats-geolocation', 'chats-sms-code'],
    goal: 'Согласовать дома простые правила по личным данным и кодам подтверждения.',
    discussion: 'Какие семейные договорённости помогут не делиться геолокацией и кодами даже «знакомым» людям?',
    skill: 'Личные границы и базовая кибергигиена в повседневном общении.',
    watchout: 'Снижение внимания к риску, когда пишет «друг» или «поддержка».',
    intro: 'Домашний формат: короткий чат-кейс + мини-задача и один практический семейный договор.',
    debriefPrompt: 'Какое семейное правило после сессии вы формулируете одним предложением?',
    nextStep: 'Следующий урок: «Классный час (10 минут)» или глава «Проверка информации» в кампании.'
  }
];

function formatClueLabel(value: string): string {
  return readableTagLabels[value] ?? value;
}

function toReadableSkillName(value: string): string {
  return readableTagLabels[value] ?? value;
}

export function ParentsPage() {
  const navigate = useNavigate();
  const { campaign, achievements, loading } = useContent();
  const { ageMode } = useAgeMode();
  const [progress, setProgress] = useState(() => readPlayerProgress());
  const [activeKitId, setActiveKitId] = useState<string | null>(null);
  const [finishedKitId, setFinishedKitId] = useState<string | null>(null);
  const [lessonJustCompleted, setLessonJustCompleted] = useState(false);
  const [activeTeacherLessonId, setActiveTeacherLessonId] = useState<TeacherLesson['id'] | null>(null);
  const [teacherLessonStep, setTeacherLessonStep] = useState<'intro' | 'play' | 'debrief' | 'summary'>('intro');
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [demoRouteStep, setDemoRouteStep] = useState(() => readDemoRouteState().step);
  const demoRouteActive = readDemoRouteState().active && isDemoModeEnabled();

  const activeKit = lessonKits.find((kit) => kit.id === activeKitId) ?? null;
  const activeTeacherLesson = lessonModeEntries.find((lesson) => lesson.id === activeTeacherLessonId) ?? null;

  const activeScenes = useMemo<StoryScene[]>(() => {
    if (!campaign || !activeKit) {
      return [];
    }

    return activeKit.sceneIds
      .map((sceneId) => campaign.scenes.find((scene) => scene.id === sceneId))
      .filter((scene): scene is StoryScene => scene !== undefined);
  }, [activeKit, campaign]);

  const activeTeacherScenes = useMemo<StoryScene[]>(() => {
    if (!campaign || !activeTeacherLesson) {
      return [];
    }

    return activeTeacherLesson.sceneIds
      .map((sceneId) => campaign.scenes.find((scene) => scene.id === sceneId))
      .filter((scene): scene is StoryScene => scene !== undefined);
  }, [activeTeacherLesson, campaign]);

  const teacherLessonSummary = useMemo(() => {
    if (!activeTeacherScenes.length) {
      return null;
    }

    const availableClues = readCluesCollection();
    const lessonClues = Array.from(new Set(activeTeacherScenes.flatMap((scene) => scene.tags ?? [])));
    const identifiedClues = lessonClues.filter((clue) => (availableClues[clue]?.count ?? 0) > 0);
    const practicedAlgorithm = activeTeacherScenes.find((scene) => scene.miniTask)?.miniTask?.algorithm ?? 'Пауза → Проверка → Безопасный выбор';

    return {
      identifiedClues: identifiedClues.map(formatClueLabel),
      practicedAlgorithm
    };
  }, [activeTeacherScenes]);

  const campaignKpi = readCampaignKpiProgress()[ageMode];
  const achievementViews = getAchievementViews(achievements);
  const unlockedAchievementsCount = achievementViews.filter((item) => item.unlocked).length;

  const safeChoices = campaignKpi?.overall.safe_choices_count ?? 0;
  const riskyChoices = campaignKpi?.overall.risky_choices_count ?? 0;
  const totalChoices = safeChoices + riskyChoices;
  const safePercent = totalChoices > 0 ? Math.round((safeChoices / totalChoices) * 100) : null;


  const mergedSkillScores = useMemo(() => {
    const tagSafeCounts = campaignKpi?.overall.tag_safe_counts ?? {};
    const tagToSkill: Record<string, SkillCard['id']> = {
      privacy: 'privacy',
      account: 'account',
      urgency: 'antifake',
      antifake: 'antifake',
      communication: 'communication',
      antibullying: 'antibullying',
      bullying_witness: 'antibullying',
      evidence: 'antibullying'
    };

    const fromCampaign: Record<SkillCard['id'], number> = {
      privacy: 0,
      account: 0,
      antifake: 0,
      communication: 0,
      antibullying: 0
    };

    for (const [tag, count] of Object.entries(tagSafeCounts)) {
      const skillId = tagToSkill[tag];
      if (skillId) {
        fromCampaign[skillId] += count;
      }
    }

    return {
      privacy: (progress.skills.privacy ?? 0) + fromCampaign.privacy,
      account: (progress.skills.account ?? 0) + fromCampaign.account,
      antifake: (progress.skills.antifake ?? 0) + fromCampaign.antifake,
      communication: (progress.skills.communication ?? 0) + fromCampaign.communication,
      antibullying: (progress.skills.antibullying ?? 0) + fromCampaign.antibullying
    };
  }, [campaignKpi, progress.skills]);

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
      'Краткий педагогический отчёт (без персональных данных)',
      `Возрастной режим: ${ageMode}`,
      `Пройдено сцен: ${campaignKpi?.overall.scenes_completed_count ?? 0}`,
      `Безопасных решений: ${safeChoices} | Рискованных решений: ${riskyChoices}${safePercent === null ? '' : ` | Доля безопасных: ${safePercent}%`}`,
      `Верные ответы в проверке: ${campaignKpi?.overall.quiz_correct_count ?? 0}/${campaignKpi?.overall.quiz_total_count ?? 0}`,
      `Финальный кейс завершён: ${(campaignKpi?.overall.chapter_final_completed ?? false) ? 'Да' : 'Нет'}`,
      `Сильная сторона / зона роста: ${skillRanking.strongest} / ${skillRanking.weakest}`
    ];

    return lines.join('\n');
  }, [ageMode, campaignKpi, riskyChoices, safeChoices, safePercent, skillRanking]);

  const competitionReportText = useMemo(() => {
    const lines = [
      'Конкурсный отчёт об образовательном эффекте (офлайн, без персональных данных)',
      `Возрастной режим: ${ageMode}`,
      `Пройдено сцен: ${campaignKpi?.overall.scenes_completed_count ?? 0}`,
      `Безопасных решений: ${safeChoices}`,
      `Рискованных решений: ${riskyChoices}`,
      `Верные ответы в проверке: ${campaignKpi?.overall.quiz_correct_count ?? 0}/${campaignKpi?.overall.quiz_total_count ?? 0}`,
      `Финальные кейсы завершены: ${(campaignKpi?.overall.chapter_final_completed ?? false) ? 'Да' : 'Нет'}`,
      `Открыто достижений: ${unlockedAchievementsCount}`,
      `Завершено мини-уроков: ${progress.completedLessonKitIds.length}/${lessonKits.length}`,
      `Самый устойчивый навык: ${skillRanking.strongest}`,
      `Навык для усиления: ${skillRanking.weakest}`
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

  const onTeacherLessonStart = (lessonId: TeacherLesson['id']) => {
    setActiveTeacherLessonId(lessonId);
    setTeacherLessonStep('intro');
  };

  const onTeacherLessonReset = () => {
    setActiveTeacherLessonId(null);
    setTeacherLessonStep('intro');
  };


  if (loading) {
    return <section><h2>Родители и наставники</h2><p>Загружаем отчёт…</p></section>;
  }

  if (activeKit && lessonJustCompleted) {
    return (
      <section>
        <h2>Урок завершён</h2>
        <p>Набор «{activeKit.title}» пройден. Отличный результат — можно вернуться к отчёту или запустить другой урок.</p>
        <button
          type="button"
          onClick={() => {
            setActiveKitId(null);
            setLessonJustCompleted(false);
          }}
        >
          Вернуться к панели
        </button>
      </section>
    );
  }

  if (activeTeacherLesson && teacherLessonStep === 'intro') {
    return (
      <section className="parents-page">
        <h2>Режим урока: {activeTeacherLesson.title}</h2>
        <article className="parents-report-panel">
          <p className="summary-label">Формат</p>
          <p className="summary-value">{activeTeacherLesson.duration}</p>
          <p>{activeTeacherLesson.intro}</p>
          <h3>Цель занятия</h3>
          <p className="section-meta">{activeTeacherLesson.goal}</p>
          <h3>Что обсудить</h3>
          <p className="section-meta">{activeTeacherLesson.discussion}</p>
          <h3>Какой навык формируется</h3>
          <p className="section-meta">{activeTeacherLesson.skill}</p>
          <h3>На что обратить внимание</h3>
          <p className="section-meta">{activeTeacherLesson.watchout}</p>
          <div className="report-buttons-row">
            <button type="button" onClick={() => setTeacherLessonStep('play')}>Начать урок</button>
            <button type="button" className="button-secondary" onClick={onTeacherLessonReset}>Назад к панели</button>
          </div>
        </article>
      </section>
    );
  }

  if (activeTeacherLesson && teacherLessonStep === 'play' && activeTeacherScenes.length > 0) {
    return (
      <section>
        <h2>Урок: {activeTeacherLesson.title}</h2>
        <ScenePlayer
          title={`${activeTeacherLesson.title} · ${activeTeacherLesson.duration}`}
          scenes={activeTeacherScenes}
          onComplete={() => setTeacherLessonStep('debrief')}
          showSceneProgress
        />
      </section>
    );
  }

  if (activeTeacherLesson && teacherLessonStep === 'debrief') {
    return (
      <section className="parents-page">
        <h2>Короткий разбор</h2>
        <article className="parents-report-panel">
          <p>{activeTeacherLesson.debriefPrompt}</p>
          <h3>Что обсудить</h3>
          <p className="section-meta">{activeTeacherLesson.discussion}</p>
          <button type="button" onClick={() => setTeacherLessonStep('summary')}>Показать итог урока</button>
        </article>
      </section>
    );
  }

  if (activeTeacherLesson && teacherLessonStep === 'summary') {
    return (
      <section className="parents-page">
        <h2>Итог урока: {activeTeacherLesson.title}</h2>
        <article className="parents-report-panel">
          <h3>Какие улики распознаны</h3>
          <ul>
            {(teacherLessonSummary?.identifiedClues.length ?? 0) > 0
              ? teacherLessonSummary?.identifiedClues.map((clue) => <li key={clue}>{clue}</li>)
              : <li>Улики пока не зафиксированы — повторите одну сцену и выберите безопасный ответ.</li>}
          </ul>
          <h3>Какой безопасный алгоритм отработан</h3>
          <p className="section-meta">{teacherLessonSummary?.practicedAlgorithm}</p>
          <h3>Следующий шаг</h3>
          <p className="section-meta">{activeTeacherLesson.nextStep}</p>
          <button type="button" onClick={onTeacherLessonReset}>Вернуться к Lesson Mode</button>
        </article>
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
      <header className="page-hero page-hero-parents">
        <p className="page-hero-kicker">Школа и семья</p>
        <h2>Панель для родителей и педагогов</h2>
        <p className="section-meta">Краткий образовательный и профилактический отчёт: какие навыки формируются, как измеряется прогресс и какие мини-уроки удобно провести в школе и дома.</p>
      </header>

      <section className="school-use-grid" aria-label="Форматы школьного использования">
        <article className="school-use-card"><h3>Подходит для классного часа</h3></article>
        <article className="school-use-card"><h3>Можно использовать во внеурочной деятельности</h3></article>
        <article className="school-use-card"><h3>Подходит для обсуждения дома с родителями</h3></article>
      </section>



      {(campaignKpi?.overall.scenes_completed_count ?? 0) === 0 && (
        <section className="empty-state" aria-label="Пустое состояние parents">
          <div className="empty-art" aria-hidden>👨‍👩‍👧‍👦</div>
          <h3>Данных пока недостаточно</h3>
          <p>Пройдите 1–2 сцены кампании, чтобы получить понятные рекомендации и видимый учебный прогресс.</p>
        </section>
      )}

      {progress.completedLessonKitIds.length === lessonKits.length && lessonKits.length > 0 && (
        <section className="completion-state">
          <h3>Все учебные наборы завершены</h3>
          <p>Вы прошли все 20-минутные наборы. Можно использовать отчёт как финальную презентацию навыков.</p>
        </section>
      )}

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
          Открыть рекомендацию
        </button>
      </article>

      {demoRouteActive && (demoRouteStep === 'parents' || demoRouteStep === 'report') && (
        <section className="parents-report-panel" aria-label="Маршрут демо-показа">
          <h3>Маршрут демонстрации</h3>
          {demoRouteStep === 'parents' && (
            <>
              <p className="section-meta">Шаг 4/5: Педагогический блок — покажите цель занятия, обсуждение после прохождения и зону внимания.</p>
              <button
                type="button"
                onClick={() => {
                  updateDemoRouteStep('report');
                  setDemoRouteStep('report');
                }}
              >
                Далее: скопировать отчёт для конкурса
              </button>
            </>
          )}
          {demoRouteStep === 'report' && (
            <p className="section-meta">Шаг 5/5: Конкурсный блок — скопируйте отчёт с образовательными и профилактическими KPI.</p>
          )}
        </section>
      )}

      <section className="parents-report-panel" aria-label="Экспорт отчётов">
        <h3>Отчёты для конкурса</h3>
        <p className="section-meta">Без персональных данных: только агрегированные KPI. Подходит для школьной презентации, отчёта по профилактике и конкурсной заявки.</p>
        <div className="report-buttons-row">
          <button type="button" className="report-button" onClick={() => copyText(shortReportText)}>Короткий отчёт</button>
          <button type="button" className="report-button report-button-emphasis" onClick={() => { void copyText(competitionReportText); if (demoRouteActive && demoRouteStep === 'report') { updateDemoRouteStep('done'); setDemoRouteStep('done'); } }}>Отчёт для конкурса</button>
        </div>
        {copyState === 'done' && <p className="status-ok">Отчёт скопирован.</p>}
        {copyState === 'error' && <p className="status-error">Не удалось скопировать отчёт.</p>}
        {demoRouteActive && demoRouteStep === 'done' && <p className="status-ok">Маршрут демо-показа завершён ✅</p>}
      </section>

      <section className="parents-report-panel" aria-label="Быстрые подсказки для педагога">
        <h3>Цель занятия</h3>
        <p className="section-meta">Отработать 1–2 безопасных алгоритма: проверка информации, защита аккаунта, корректная реакция на травлю.</p>
        <h3>Что обсудить после прохождения</h3>
        <p className="section-meta">Какое решение оказалось самым полезным в школе, что можно применить дома и к кому обратиться за поддержкой.</p>
        <h3>На что обратить внимание</h3>
        <p className="section-meta">Где ученик сомневается, какие сигналы риска пропускает и как меняется доля безопасных решений.</p>
        <h3>Какой навык формируется</h3>
        <p className="section-meta">Цифровая грамотность, профилактическое мышление и спокойная коммуникация в конфликтных ситуациях.</p>
      </section>

      <section className="parents-report-panel" aria-label="Быстрый выбор сценария">
        <h3>Быстрый выбор сценария</h3>
        <div className="lesson-mode-grid" aria-label="Lesson Mode">
          {lessonModeEntries.map((entry) => (
            <article className="lesson-mode-card" key={entry.id}>
              <h4>{entry.title} ({entry.duration})</h4>
              <p className="section-meta">{entry.goal}</p>
              <button type="button" onClick={() => onTeacherLessonStart(entry.id)}>
                Запустить Lesson Mode
              </button>
            </article>
          ))}
        </div>
        <div className="quick-picks-grid">
          <article className="quick-pick-card">
            <h4>Для классного часа</h4>
            <p className="section-meta">20-минутный мини-урок «Антифейк» + обсуждение сигналов риска в школьных чатах.</p>
            <button type="button" onClick={() => { setLessonJustCompleted(false); setActiveKitId('kit-antifake'); }}>
              Открыть мини-урок
            </button>
          </article>
          <article className="quick-pick-card">
            <h4>Для разговора с родителями</h4>
            <p className="section-meta">Набор «Приватность» с фокусом на домашние договорённости и границы личных данных.</p>
            <button type="button" onClick={() => { setLessonJustCompleted(false); setActiveKitId('kit-privacy'); }}>
              Открыть набор
            </button>
          </article>
          <article className="quick-pick-card">
            <h4>Для профилактики</h4>
            <p className="section-meta">Демо-маршрут: учебная кампания → школьная сцена → улики → педагогический и конкурсный отчёт.</p>
            <button type="button" onClick={() => navigate('/campaign')}>
              Перейти к маршруту
            </button>
          </article>
        </div>
      </section>

      <div className="parents-grid">
        {skillCards.map((skill) => {
          const score = mergedSkillScores[skill.id] ?? 0;
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

      <h3>20-минутные мини-уроки</h3>
      <p className="section-meta">Подходит для классного часа и семейного разговора: короткий разбор, профилактика рисков и измеримый прогресс по навыкам.</p>
      <div className="kits-grid">
        {lessonKits.map((kit) => {
          const isCompleted = progress.completedLessonKitIds.includes(kit.id);
          const isFinishedNow = finishedKitId === kit.id;

          return (
            <article key={kit.id} className="kit-card">
              <h4>{kit.title} ({kit.sceneIds.length} сцен)</h4>
              <p className="section-meta">Что обсудить после прохождения: 1 безопасное действие ребёнка и 1 шаг поддержки взрослого.</p>
              {(isCompleted || isFinishedNow) && <span className="badge">Пройдено</span>}
              <button
                type="button"
                onClick={() => {
                  setLessonJustCompleted(false);
                  setActiveKitId(kit.id);
                }}
                disabled={!campaign}
              >
                Открыть урок
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
