import { useMemo, useState } from 'react';
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

export function CampaignPage() {
  const { campaign, achievements, loading, error, source } = useContent();
  const { ageMode } = useAgeMode();
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress>(() => readCampaignProgress());
  const [kpiProgress, setKpiProgress] = useState<CampaignKpiProgress>(() => readCampaignKpiProgress());
  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null);
  const [summaryChapterId, setSummaryChapterId] = useState<string | null>(null);

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
    return <section><h2>Campaign</h2><p>Campaign unavailable offline. Connect once to cache packs.</p></section>;
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
    setActiveFlow({ kind: 'final', chapter, scenes: [finalScene], title: `${chapter.title}: Final case` });
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

    setActiveFlow({ kind: 'repeat', chapter, scenes: selected, title: `${chapter.title}: Repeat weak skill` });
    setSummaryChapterId(null);
  };

  const summaryChapter = summaryChapterId ? chapters.find((chapter) => chapter.id === summaryChapterId) : null;
  const summaryMetrics = summaryChapter ? modeKpi?.chapters[summaryChapter.id] : undefined;

  if (activeFlow) {
    return (
      <section>
        <h2>{campaign.title}</h2>
        <p>Source: {source === 'network' ? 'Online sync' : 'Cached offline packs'}</p>
        <button type="button" onClick={() => setActiveFlow(null)}>← Back to city map</button>
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
      <section>
        <h2>Chapter Summary: {summaryChapter.title}</h2>
        <p>Scenes completed: {summaryMetrics.scenes_completed_count}</p>
        <p>Choices: safe {summaryMetrics.safe_choices_count} / risky {summaryMetrics.risky_choices_count}</p>
        <p>Quiz: {summaryMetrics.quiz_correct_count}/{summaryMetrics.quiz_total_count}</p>
        <p>Final completed: {summaryMetrics.chapter_final_completed ? 'Yes' : 'No'}</p>

        <h3>Recommendations</h3>
        <ol>
          {recommendations.map((tag, index) => (
            <li key={`${tag}-${index}`}>Repeat practice for: {tag}</li>
          ))}
        </ol>

        <div className="chapter-actions">
          <button type="button" onClick={() => openRepeatWeakSkill(summaryChapter)}>Repeat weak skill</button>
          <button type="button" onClick={() => setSummaryChapterId(null)}>Back to city map</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2>{campaign.title}</h2>
      <p>Source: {source === 'network' ? 'Online sync' : 'Cached offline packs'}</p>
      <h3>City map</h3>
      <div className="campaign-map">
        {chapters.map((chapter) => {
          const totalScenes = chapter.scene_ids.length;
          const completedScenes = chapter.scene_ids.filter((sceneId) => modeProgress.completedScenes[sceneId]).length;
          const percent = totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0;
          const chapterFinalUnlocked = totalScenes > 0 && completedScenes >= totalScenes;
          const chapterFinalDone = Boolean(modeProgress.completedFinals[chapter.id]);
          const isStarted = completedScenes > 0;

          return (
            <article key={chapter.id} className="chapter-card">
              <h4>{chapter.title}</h4>
              <p>Progress: {completedScenes}/{totalScenes} ({percent}%)</p>
              <div className="chapter-actions">
                <button type="button" onClick={() => openChapter(chapter)}>
                  {isStarted ? 'Continue' : 'Start chapter'}
                </button>
                <button type="button" onClick={() => openFinal(chapter)} disabled={!chapterFinalUnlocked}>
                  Final case{chapterFinalDone ? ' ✅' : ''}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
