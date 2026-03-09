import { type CSSProperties, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContent } from '../contentContext';
import { ScenePlayer } from '../components/ScenePlayer';
import { processAchievementEvent, type GameEvent } from '../achievements';
import { useAgeMode } from '../ageMode';
import {
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
  type RiskLevel
} from '../playerProgress';
import type { CampaignChapter, StoryScene } from '../contentEngine';
import { readDemoRouteState, updateDemoRouteStep } from '../demoRoute';
import { isDemoModeEnabled } from '../demoMode';

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

const CHAPTER_CARD_THEMES = [
  { icon: '🌆', accent: '#4f46e5' },
  { icon: '🛰️', accent: '#0ea5e9' },
  { icon: '🧩', accent: '#f59e0b' },
  { icon: '🛡️', accent: '#10b981' },
  { icon: '🚨', accent: '#ef4444' }
];

function chapterDescription(chapter: CampaignChapter): string {
  const words = chapter.title
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(' ');

  return words
    ? `Разберись с рисками в теме «${words}» и подготовься к финальному кейсу.`
    : 'Тренируйся на сценах, чтобы уверенно дойти до финального кейса.';
}

export function CampaignPage() {
  const navigate = useNavigate();
  const { campaign, achievements, loading, error, source, retrySync } = useContent();
  const { ageMode } = useAgeMode();
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress>(() => readCampaignProgress());
  const [kpiProgress, setKpiProgress] = useState<CampaignKpiProgress>(() => readCampaignKpiProgress());
  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null);
  const [summaryChapterId, setSummaryChapterId] = useState<string | null>(null);

  const [demoRouteStep, setDemoRouteStep] = useState(() => readDemoRouteState().step);
  const demoRouteActive = readDemoRouteState().active && isDemoModeEnabled();

  const modeProgress = campaignProgress[ageMode] ?? { completedScenes: {}, completedFinals: {} };
  const modeKpi = kpiProgress[ageMode];

  const chapters = useMemo(() => campaign?.chapters ?? [], [campaign]);
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

    if (event.type === 'scene_completed') {
      const sceneId = String(event.payload.sceneId ?? '');
      const chapterId = String(event.payload.chapterId ?? sceneToChapter[sceneId] ?? '');
      if (!sceneId || !chapterId) {
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
    return <section><h2>Campaign</h2><p>Syncing content packs…</p></section>;
  }

  if (error || !campaign) {
    return (
      <section>
        <h2>Campaign</h2>
        <p>Campaign unavailable offline. Connect once to cache packs.</p>
        {error && <p>{error}</p>}
        <button type="button" onClick={() => void retrySync()}>Retry sync</button>
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
    setActiveFlow({ kind: 'chapter', chapter, scenes: [scene], title: 'Demo messenger scene' });
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
            <li key={`${tag}-${index}`}>Повторить практику по теме: {tag}</li>
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
        <p className="campaign-hero-kicker">Campaign</p>
        <h2>{campaign.title}</h2>
        <p className="campaign-hero-subtitle">
          Пройди «город рисков»: от быстрых диалогов до финальных кейсов с разбором и квизом.
        </p>
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

      {demoRouteActive && (
        <section className="parents-report-panel" aria-label="Demo route guidance">
          <h3>Demo route</h3>
          {demoRouteStep === 'campaign' && (
            <>
              <p className="section-meta">Шаг 1/5: Покажите титульный блок кампании и карту города рисков.</p>
              <button
                type="button"
                onClick={() => {
                  updateDemoRouteStep('messenger');
                  setDemoRouteStep('messenger');
                }}
              >
Далее: сцена в чате
              </button>
            </>
          )}
          {demoRouteStep === 'messenger' && (
            <>
              <p className="section-meta">Шаг 2/5: Запустите одну чат-сцену с вложением.</p>
              <button type="button" onClick={openDemoMessengerScene}>Запустить демо-сцену чата</button>
            </>
          )}
        </section>
      )}



      {chapters.length > 0 && chapters.every((chapter) => Boolean(modeProgress.completedFinals[chapter.id])) && (
        <section className="completion-state" aria-label="Кампания завершена">
          <h3>Кампания полностью завершена</h3>
          <p>Все финальные кейсы пройдены. Результат готов для демонстрации жюри.</p>
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
          const theme = CHAPTER_CARD_THEMES[index % CHAPTER_CARD_THEMES.length];
          const actionLabel = chapterFinalUnlocked ? (chapterFinalDone ? 'Финал пройден ✅' : 'Финальный кейс') : isStarted ? 'Продолжить' : 'Начать';
          const action = chapterFinalUnlocked ? () => openFinal(chapter) : () => openChapter(chapter);

          return (
            <article key={chapter.id} className="chapter-card city-card" style={{ '--chapter-accent': theme.accent } as CSSProperties}>
              <div className="chapter-card-head">
                <p className="chapter-icon" aria-hidden="true">{theme.icon}</p>
                <div>
                  <h4>{chapter.title}</h4>
                  <p className="chapter-description">{chapterDescription(chapter)}</p>
                </div>
              </div>
              <p className="chapter-progress-label">Прогресс: {completedScenes}/{totalScenes} ({percent}%)</p>
              <div className="progress" aria-hidden="true">
                <div className="progress-bar" style={{ width: `${percent}%` }} />
              </div>
              <p className="chapter-status-row">
                <span className={`status-pill ${chapterFinalDone ? 'safe' : chapterFinalUnlocked ? 'neutral' : 'risky'}`}>
                  {chapterFinalDone ? 'Финал главы пройден' : chapterFinalUnlocked ? 'Финал открыт' : 'Завершите сцены, чтобы открыть финал'}
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
      </div>
    </section>
  );
}
