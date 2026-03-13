import { type CSSProperties, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContent } from '../contentContext';
import { ScenePlayer } from '../components/ScenePlayer';
import { processAchievementEvent, type GameEvent } from '../achievements';
import { useAgeMode } from '../ageMode';
import {
  incrementPlayerSkill,
  markCampaignMiniTaskCompleted,
  markCampaignSceneCompleted,
  markChapterFinalCompleted,
  markChapterFinalKpiCompleted,
  readCampaignKpiProgress,
  readCampaignProgress,
  recordCampaignQuizKpi,
  recordCampaignSceneKpi,
  type CampaignKpiProgress,
  type CampaignProgress,
  type ChapterKpiMetrics,
  type RiskLevel,
} from '../playerProgress';
} from '../playerProgress';
import type { CampaignChapter, StoryScene } from '../contentEngine';
import { readDemoRouteState, updateDemoRouteStep } from '../demoRoute';
import { isDemoModeEnabled } from '../demoMode';
import { readCluesCollection } from '../cluesCollection';
import { calculateProgressSummary } from '../progression';


const READABLE_TAG_LABELS: Record<string, string> = {
  urgency: 'Давление и срочность',
  privacy: 'Личные данные',
  account: 'Защита аккаунта',
  antifake: 'Проверка информации',
  evidence: 'Сохранение доказательств',
  bullying_witness: 'Реакция на травлю',
  antibullying: 'Реакция на травлю',
  communication: 'Безопасное общение',
  review_quiz_accuracy: 'Точность ответов в проверке понимания',
  review_safe_choices: 'Доля безопасных решений'
};

function toReadableTagLabel(tag: string): string {
  return READABLE_TAG_LABELS[tag] ?? tag;
}

type ActiveFlow =
  | { kind: 'chapter'; chapter: CampaignChapter; scenes: StoryScene[]; title: string }
  | { kind: 'final'; chapter: CampaignChapter; scenes: StoryScene[]; title: string }
  | { kind: 'repeat'; chapter: CampaignChapter; scenes: StoryScene[]; title: string };

function topRiskyTags(metrics: ChapterKpiMetrics | undefined): string[] {
  if (!metrics) {
    return [];
  }

  return Object.entries(metrics.risky_tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
}


const DISTRICT_BADGES: Record<string, string> = {
  'chapter-chats': '🏅 Значок: Школьный защитник',
  'chapter-social': '🏅 Значок: Безопасный блогер',
  'chapter-games': '🏅 Значок: Честный игрок',
  'chapter-fakes': '🏅 Значок: Проверяющий факты',
  'chapter-cyberbullying': '🏅 Значок: Друг и защитник'
};

const DISTRICT_META: Record<string, { title: string; icon: string; accent: string; description: string }> = {
  'chapter-chats': {
    title: 'Школа',
    icon: '🏫',
    accent: '#4f46e5',
    description: 'Классные чаты, школьные объявления и просьбы «срочно».'
  },
  'chapter-social': {
    title: 'Соцсети',
    icon: '📱',
    accent: '#0ea5e9',
    description: 'Профиль, сторис и личные сообщения: учимся держать границы.'
  },
  'chapter-games': {
    title: 'Игровой клуб',
    icon: '🎮',
    accent: '#f59e0b',
    description: 'Командная игра, донаты и голосовые чаты без ловушек.'
  },
  'chapter-fakes': {
    title: 'Новости и фейки',
    icon: '📰',
    accent: '#14b8a6',
    description: 'Проверяем слухи, фейковые «новости» и поддельные каналы.'
  },
  'chapter-cyberbullying': {
    title: 'Давление и травля',
    icon: '🧭',
    accent: '#ef4444',
    description: 'Как поддержать, зафиксировать доказательства и обратиться за помощью.'
  }
};

export function CampaignPage() {
  const navigate = useNavigate();
  const { campaign, achievements, loading, error, source, retrySync } = useContent();
  const { ageMode } = useAgeMode();
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress>(() => readCampaignProgress());
  const [kpiProgress, setKpiProgress] = useState<CampaignKpiProgress>(() => readCampaignKpiProgress());
  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null);
  const [summaryChapterId, setSummaryChapterId] = useState<string | null>(null);
  const [microReward, setMicroReward] = useState<string | null>(null);

  const [demoRouteStep, setDemoRouteStep] = useState(() => readDemoRouteState().step);
  const demoRouteActive = readDemoRouteState().active && isDemoModeEnabled();

  const modeProgress = campaignProgress[ageMode] ?? { completedScenes: {}, completedFinals: {}, completedMiniTasks: {} };
  const modeKpi = kpiProgress[ageMode];
  const clues = readCluesCollection();

  const chapters = useMemo(() => campaign?.chapters ?? [], [campaign]);
  const sceneById = useMemo(() => {
    return new Map((campaign?.scenes ?? []).map((scene) => [scene.id, scene]));
  }, [campaign]);
  const sceneToChapter = useMemo(() => {
    const index: Record<string, string> = {};
    for (const chapter of chapters) {
      for (const sceneId of chapter.scene_ids) {
        index[sceneId] = chapter.id;
      }
      index[chapter.final_scene] = chapter.id;
    }
    return index;
  }, [chapters]);


  const progression = useMemo(
    () => calculateProgressSummary(modeProgress, chapters, clues, modeKpi?.overall.safe_choices_count ?? 0),
    [modeProgress, chapters, clues, modeKpi]
  );

  const onEvent = (event: GameEvent) => {
    processAchievementEvent(achievements, event);

    if (event.type === 'quiz_answered') {
      const chapterId = String(event.payload.chapterId ?? sceneToChapter[String(event.payload.sceneId ?? '')] ?? '');
      if (!chapterId) {
        return;
      }
      const progress = recordCampaignQuizKpi(ageMode, chapterId, Boolean(event.payload.correct));
      setKpiProgress(progress);
    }

    if (event.type === 'skill_changed') {
      const skill = String(event.payload.skill ?? '');
      const increment = Number(event.payload.level ?? 0);
      if (skill && increment > 0) {
        incrementPlayerSkill(skill, increment);
      }
      return;
    }

    if (event.type === 'scene_completed') {
      const sceneId = String(event.payload.sceneId ?? '');
      const chapterId = String(event.payload.chapterId ?? sceneToChapter[sceneId] ?? '');
      if (!sceneId || !chapterId) {
        return;
      }

      if (event.payload.mini_task_completed === true) {
        const progress = markCampaignMiniTaskCompleted(ageMode, sceneId);
        setCampaignProgress(progress);
        return;
      }

      const riskLevel = String(event.payload.risk_level ?? 'neutral') as RiskLevel;
      const safe = riskLevel === 'safe';
      const progress = markCampaignSceneCompleted(ageMode, sceneId, safe);
      setCampaignProgress(progress);

      const kpi = recordCampaignSceneKpi(ageMode, chapterId, sceneId, riskLevel, String(event.payload.tag ?? ''));
      setKpiProgress(kpi);
    }
  };

  if (loading) {
    return <section><h2>Кампания</h2><p>Обновляем учебные материалы…</p></section>;
  }

  if (error || !campaign) {
    return (
      <section>
        <h2>Кампания</h2>
        <p>Кампания пока недоступна офлайн. Подключитесь к сети один раз, чтобы сохранить материалы.</p>
        {error && <p>{error}</p>}
        <button type="button" onClick={() => void retrySync()}>Повторить синхронизацию</button>
      </section>
    );
  }

  const openChapter = (chapter: CampaignChapter) => {
    const scenes = chapter.scene_ids
      .map((sceneId) => campaign.scenes.find((scene) => scene.id === sceneId))
      .filter((scene): scene is StoryScene => Boolean(scene));

    if (scenes.length === 0) {
      return;
    }

    setSummaryChapterId(null);
    setActiveFlow({ kind: 'chapter', chapter, scenes, title: chapter.title });
  };

  const openFinal = (chapter: CampaignChapter) => {
    const finalScene = campaign.scenes.find((scene) => scene.id === chapter.final_scene);
    if (!finalScene) {
      return;
    }
    setSummaryChapterId(null);
    setActiveFlow({ kind: 'final', chapter, scenes: [finalScene], title: `${chapter.title}: Финальный кейс` });
  };

  const openDemoMessengerScene = () => {
    const scene = campaign.scenes.find((item) => item.id === 'chats-evidence-trade');
    if (!scene) {
      return;
    }

    const chapter = chapters.find((item) => item.scene_ids.includes(scene.id));
    if (!chapter) {
      return;
    }

    setSummaryChapterId(null);
    setActiveFlow({ kind: 'chapter', chapter, scenes: [scene], title: 'Демо-сцена школьного чата' });
  };

  const openRepeatWeakSkill = (chapter: CampaignChapter) => {
    const chapterMetrics = modeKpi?.chapters[chapter.id];
    const preferredTags = topRiskyTags(chapterMetrics);

    const selected = chapter.scene_ids
      .map((sceneId) => campaign.scenes.find((scene) => scene.id === sceneId))
      .filter((scene): scene is StoryScene => Boolean(scene))
      .sort((a, b) => {
        const aMatch = preferredTags.some((tag) => (a.tags ?? []).includes(tag)) ? 1 : 0;
        const bMatch = preferredTags.some((tag) => (b.tags ?? []).includes(tag)) ? 1 : 0;
        return bMatch - aMatch;
      })
      .slice(0, 3);

    if (selected.length === 0) {
      return;
    }

    setActiveFlow({ kind: 'repeat', chapter, scenes: selected, title: `${chapter.title}: Повторить слабый навык` });
    setSummaryChapterId(null);
  };

  const summaryChapter = summaryChapterId ? chapters.find((chapter) => chapter.id === summaryChapterId) : null;
  const summaryMetrics = summaryChapter ? modeKpi?.chapters[summaryChapter.id] : undefined;
  if (activeFlow) {
    return (
      <section>
        <h2>{campaign.title}</h2>
        <p className="section-meta">Источник: {source === 'network' ? 'Синхронизация онлайн' : 'Локальный кэш'}</p>
        <button type="button" onClick={() => setActiveFlow(null)}>← Вернуться к карте</button>
        <ScenePlayer
          title={activeFlow.title}
          scenes={activeFlow.scenes}
          ageMode={ageMode}
          eventContext={{ chapterId: activeFlow.chapter.id }}
          onEvent={onEvent}
          onComplete={() => {
            if (activeFlow.kind === 'final') {
              const progress = markChapterFinalCompleted(ageMode, activeFlow.chapter.id);
              setCampaignProgress(progress);
              const kpi = markChapterFinalKpiCompleted(ageMode, activeFlow.chapter.id);
              setKpiProgress(kpi);
              setSummaryChapterId(activeFlow.chapter.id);
            }
            if (demoRouteActive && demoRouteStep === 'messenger') {
              updateDemoRouteStep('clues');
              setDemoRouteStep('clues');
              navigate('/clues');
              return;
            }
            setActiveFlow(null);
          }}
          showSceneProgress
          onMicroReward={(message) => setMicroReward(message)}
        />
      </section>
    );
  }

  if (summaryChapter && summaryMetrics) {
    const riskyTags = topRiskyTags(summaryMetrics);
    const recommendations = [...riskyTags, 'review_quiz_accuracy', 'review_safe_choices'].slice(0, 3);

    return (
      <section className="campaign-page">
        <h2>Итоги главы: {summaryChapter.title}</h2>
        <p>Сцен пройдено: {summaryMetrics.scenes_completed_count}</p>
        <p>Выборы: безопасные {summaryMetrics.safe_choices_count} / рискованные {summaryMetrics.risky_choices_count}</p>
        <p>Квиз: {summaryMetrics.quiz_correct_count}/{summaryMetrics.quiz_total_count}</p>
        <p>Финал главы: {summaryMetrics.chapter_final_completed ? 'пройден' : 'ещё не пройден'}</p>

        <h3>Рекомендации</h3>
        <ol>
          {recommendations.map((tag, index) => (
            <li key={`${tag}-${index}`}>Повторить практику по теме: {toReadableTagLabel(tag)}</li>
          ))}
        </ol>

        <div className="chapter-actions">
          <button type="button" onClick={() => openRepeatWeakSkill(summaryChapter)}>Повторить слабый навык</button>
          <button type="button" onClick={() => setSummaryChapterId(null)}>Вернуться к карте</button>
        </div>
      </section>
    );
  }

  return (
    <section className="campaign-page">
      <header className="campaign-hero">
        <p className="campaign-hero-kicker">Учебная кампания</p>
        <h2>{campaign.title}</h2>
        <p className="campaign-hero-subtitle">
          Пройди «карту школьных ситуаций»: от чатов класса до финальных кейсов с разбором. Формируются навыки проверки информации, защиты аккаунта и безопасного общения.
        </p>
        <p className="section-meta">Чему учимся: распознавать школьный фишинг, защищать аккаунт электронного дневника, безопасно реагировать на травлю и обсуждать решения с семьёй и классом.</p>
        <div className="campaign-hero-actions">
          <button
            type="button"
            onClick={() => {
              const nextChapter = chapters.find((chapter) => {
                const totalScenes = chapter.scene_ids.length;
                const completedScenes = chapter.scene_ids.filter((sceneId) => modeProgress.completedScenes[sceneId]).length;
                return completedScenes < totalScenes || !modeProgress.completedFinals[chapter.id];
              });
              if (nextChapter) {
                openChapter(nextChapter);
              }
            }}
          >
            Продолжить
          </button>
          {isDemoModeEnabled() && (
            <button
              type="button"
              onClick={() => {
                updateDemoRouteStep('campaign');
                setDemoRouteStep('campaign');
              }}
            >
              Запустить демо-маршрут
            </button>
          )}
          <p className="section-meta">Источник: {source === 'network' ? 'Синхронизация онлайн' : 'Локальный кэш'}</p>
        </div>
      </header>


      <section className="clues-summary" aria-label="Уровень прогресса">
        <article className="summary-metric">
          <p className="summary-label">Текущий титул</p>
          <p className="summary-value">{progression.title}</p>
          <p className="section-meta">Очки: {progression.score}</p>
        </article>
        <article className="summary-metric">
          <p className="summary-label">Рост до следующего титула</p>
          <p className="summary-value">{progression.nextTitle ?? 'Максимум'}</p>
          <div className="progress" aria-hidden="true"><div className="progress-bar" style={{ width: `${progression.progressToNext}%` }} /></div>
        </article>
      </section>

      {microReward && (
        <section className="task-reward task-reward-burst" aria-label="Микро-награда">
          <p>✨ {microReward}</p>
        </section>
      )}

      <section className="parents-report-panel" aria-label="Практическое использование в школе и семье">
        <h3>Подходит для классного часа</h3>
        <p className="section-meta">Каждую сцену можно разобрать за 3–5 минут: где риск, какое безопасное действие и к кому обратиться в школе.</p>
        <h3>Можно использовать во внеурочной деятельности</h3>
        <p className="section-meta">Подходит для кружка, медиаклуба и школьной профилактической недели: короткие сцены + измеримый результат.</p>
        <h3>Подходит для обсуждения дома с родителями</h3>
        <p className="section-meta">После занятия легко продолжить разговор дома по тем же кейсам, без перегруза методикой.</p>
        <h3>Что обсудить после прохождения</h3>
        <p className="section-meta">Какие школьные сообщения проверяем через официальный канал, какие ссылки игнорируем и как действуем свидетелем травли.</p>
        <h3>На что обратить внимание взрослому</h3>
        <p className="section-meta">В отчёте видны измеримые показатели: доля безопасных решений, ответы в квизах и навыки, которые требуют повторения.</p>
      </section>

      {demoRouteActive && (
        <section className="parents-report-panel" aria-label="Маршрут демо-показа">
          <h3>Маршрут демонстрации</h3>
          {demoRouteStep === 'campaign' && (
            <>
              <p className="section-meta">Шаг 1/5: Вступление для школы — покажите учебную кампанию и карту ситуаций для классного часа.</p>
              <button
                type="button"
                onClick={() => {
                  updateDemoRouteStep('messenger');
                  setDemoRouteStep('messenger');
                }}
              >
                Далее: сцена школьного чата
              </button>
            </>
          )}
          {demoRouteStep === 'messenger' && (
            <>
              <p className="section-meta">Шаг 2/5: Запустите одну школьную чат-сцену с вложением и разберите безопасное решение.</p>
              <button type="button" onClick={openDemoMessengerScene}>Запустить демо-сцену</button>
            </>
          )}
        </section>
      )}



      {chapters.length > 0 && chapters.every((chapter) => Boolean(modeProgress.completedFinals[chapter.id])) && (
        <section className="completion-state" aria-label="Кампания завершена">
          <h3>Кампания полностью завершена</h3>
          <p>Все финальные кейсы пройдены. Результат готов для демонстрации жюри: видно динамику решений и освоенные навыки.</p>
        </section>
      )}

      <h3 className="campaign-map-title">Город рисков</h3>
      <div className="campaign-map">
        {chapters.map((chapter, index) => {
          const totalScenes = chapter.scene_ids.length;
          const completedScenes = chapter.scene_ids.filter((sceneId) => modeProgress.completedScenes[sceneId]).length;
          const percent = totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0;
          const chapterFinalUnlocked = totalScenes > 0 && completedScenes >= totalScenes;
          const chapterFinalDone = Boolean(modeProgress.completedFinals[chapter.id]);
          const isStarted = completedScenes > 0;
          const nextSceneId = chapter.scene_ids.find((sceneId) => !modeProgress.completedScenes[sceneId]);
          const nextMission = nextSceneId ? sceneById.get(nextSceneId)?.title ?? 'Следующая миссия' : 'Все миссии района пройдены';
          const district = DISTRICT_META[chapter.id] ?? {
            title: chapter.title,
            icon: ['🌆', '🛰️', '🧩', '🛡️', '🚨'][index % 5],
            accent: ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444'][index % 5],
            description: 'Тренируйся на сценах, чтобы уверенно дойти до финального кейса.'
          };
          const districtTone = chapterFinalDone ? 'district-safe' : isStarted ? 'district-risk' : 'district-locked';
          const actionLabel = chapterFinalUnlocked ? (chapterFinalDone ? 'Переиграть финал' : 'Финальный кейс') : isStarted ? 'Продолжить миссии' : 'Войти в район';
          const action = chapterFinalUnlocked ? () => openFinal(chapter) : () => openChapter(chapter);

          return (
            <article key={chapter.id} className={`chapter-card city-card ${districtTone}`} style={{ '--chapter-accent': district.accent } as CSSProperties}>
              <div className="chapter-card-head">
                <p className="chapter-icon" aria-hidden="true">{district.icon}</p>
                <div>
                  <h4>{district.title}</h4>
                  <p className="chapter-description">{district.description}</p>
                </div>
              </div>
              <p className="chapter-progress-label">Прогресс: {completedScenes}/{totalScenes} ({percent}%)</p>
              {chapterFinalDone && <p className="badge">{DISTRICT_BADGES[chapter.id] ?? '🏅 Награда района открыта'}</p>}
              <div className="progress" aria-hidden="true">
                <div className="progress-bar" style={{ width: `${percent}%` }} />
              </div>
              <p className="chapter-description">Следующая миссия: <strong>{nextMission}</strong></p>
              <p className="chapter-status-row">
                <span className={`status-pill ${chapterFinalDone ? 'safe' : chapterFinalUnlocked ? 'neutral' : 'risky'}`}>
                  {chapterFinalDone ? '✅ Район завершён, награда открыта' : chapterFinalUnlocked ? 'Финал открыт' : 'Соберите сцены, чтобы открыть финал района'}
                </span>
              </p>
              <div className="chapter-actions chapter-actions-single">
                <button type="button" onClick={action}>
                  {actionLabel}
                </button>
              </div>
            </article>
          );
        })}
        <article className="chapter-card city-card district-safe support-district" style={{ '--chapter-accent': '#22c55e' } as CSSProperties}>
          <div className="chapter-card-head">
            <p className="chapter-icon" aria-hidden="true">🏠</p>
            <div>
              <h4>Дом и поддержка</h4>
              <p className="chapter-description">Район помощи: обсуждаем решения с близкими и классом.</p>
            </div>
          </div>
          <p className="chapter-progress-label">Прогресс: всегда доступен</p>
          <div className="progress" aria-hidden="true">
            <div className="progress-bar" style={{ width: '100%' }} />
          </div>
          <p className="chapter-description">Следующая миссия: открыть рекомендации для родителей и учителей</p>
          <p className="chapter-status-row"><span className="status-pill safe">Центр поддержки открыт всегда</span></p>
          <div className="chapter-actions chapter-actions-single">
            <button type="button" onClick={() => navigate('/parents')}>Открыть район поддержки</button>
          </div>
        </article>
      </div>
    </section>
  );
}
