import { useMemo, useState } from 'react';
import { useContent } from '../contentContext';
import { ScenePlayer } from '../components/ScenePlayer';
import { processAchievementEvent, type GameEvent } from '../achievements';
import { useAgeMode } from '../ageMode';
import {
  markCampaignSceneCompleted,
  markChapterFinalCompleted,
  readCampaignProgress,
  type CampaignProgress
} from '../playerProgress';
import type { CampaignChapter, StoryScene } from '../contentEngine';

type ActiveFlow =
  | { kind: 'chapter'; chapter: CampaignChapter; scenes: StoryScene[]; title: string }
  | { kind: 'final'; chapter: CampaignChapter; scenes: StoryScene[]; title: string };

export function CampaignPage() {
  const { campaign, achievements, loading, error, source } = useContent();
  const { ageMode } = useAgeMode();
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress>(() => readCampaignProgress());
  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null);

  const modeProgress = campaignProgress[ageMode] ?? { completedScenes: {}, completedFinals: {} };

  const onEvent = (event: GameEvent) => {
    processAchievementEvent(achievements, event);

    if (event.type === 'scene_completed') {
      const sceneId = String(event.payload.sceneId ?? '');
      if (!sceneId) {
        return;
      }
      const safe = Boolean(event.payload.safe);
      const progress = markCampaignSceneCompleted(ageMode, sceneId, safe);
      setCampaignProgress(progress);
    }
  };

  const chapters = useMemo(() => campaign?.chapters ?? [], [campaign]);

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

    setActiveFlow({ kind: 'chapter', chapter, scenes, title: chapter.title });
  };

  const openFinal = (chapter: CampaignChapter) => {
    const finalScene = campaign.scenes.find((scene) => scene.id === chapter.final_scene);
    if (!finalScene) {
      return;
    }
    setActiveFlow({ kind: 'final', chapter, scenes: [finalScene], title: `${chapter.title}: Final case` });
  };

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
          onEvent={onEvent}
          onComplete={() => {
            if (activeFlow.kind === 'final') {
              const progress = markChapterFinalCompleted(ageMode, activeFlow.chapter.id);
              setCampaignProgress(progress);
            }
            setActiveFlow(null);
          }}
          showSceneProgress
        />
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
