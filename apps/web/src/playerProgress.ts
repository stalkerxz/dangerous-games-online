export type PlayerProgress = {
  completedWeeklyIds: string[];
  completedLessonKitIds: string[];
  badges: string[];
  skills: Record<string, number>;
};

export type CampaignModeProgress = {
  completedScenes: Record<string, { safe: boolean }>;
  completedFinals: Record<string, boolean>;
};

export type CampaignProgress = Record<string, CampaignModeProgress>;

export type RiskLevel = 'safe' | 'risky' | 'neutral';

export type ChapterKpiMetrics = {
  scenes_completed_count: number;
  safe_choices_count: number;
  risky_choices_count: number;
  quiz_correct_count: number;
  quiz_total_count: number;
  chapter_final_completed: boolean;
  risky_tags: Record<string, number>;
  risky_scene_ids: string[];
};

export type CampaignKpiMetrics = {
  chapters: Record<string, ChapterKpiMetrics>;
  overall: ChapterKpiMetrics;
};

export type CampaignKpiProgress = Record<string, CampaignKpiMetrics>;

const PROGRESS_KEY = 'dgo-player-progress:v1';
const CAMPAIGN_PROGRESS_KEY = 'dgo-campaign-progress:v1';
const CAMPAIGN_KPI_KEY = 'dgo-campaign-kpi:v1';

const EMPTY_PROGRESS: PlayerProgress = {
  completedWeeklyIds: [],
  completedLessonKitIds: [],
  badges: [],
  skills: {}
};

export function readPlayerProgress(): PlayerProgress {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) {
    return EMPTY_PROGRESS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    return {
      completedWeeklyIds: parsed.completedWeeklyIds ?? [],
      completedLessonKitIds: parsed.completedLessonKitIds ?? [],
      badges: parsed.badges ?? [],
      skills: parsed.skills ?? {}
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function completeLessonKit(kitId: string): PlayerProgress {
  const current = readPlayerProgress();
  if (current.completedLessonKitIds.includes(kitId)) {
    return current;
  }

  const progress: PlayerProgress = {
    ...current,
    completedLessonKitIds: [...current.completedLessonKitIds, kitId]
  };

  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  return progress;
}

export function completeWeeklyMission(
  weeklyId: string,
  reward: { badge: string; skills: Record<string, number> }
): { updated: boolean; progress: PlayerProgress } {
  const current = readPlayerProgress();
  if (current.completedWeeklyIds.includes(weeklyId)) {
    return { updated: false, progress: current };
  }

  const completedWeeklyIds = [...current.completedWeeklyIds, weeklyId];
  const badges = current.badges.includes(reward.badge)
    ? current.badges
    : [...current.badges, reward.badge];

  const skills = { ...current.skills };
  for (const [skill, increment] of Object.entries(reward.skills)) {
    skills[skill] = (skills[skill] ?? 0) + increment;
  }

  const progress: PlayerProgress = {
    completedWeeklyIds,
    completedLessonKitIds: current.completedLessonKitIds,
    badges,
    skills
  };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  return { updated: true, progress };
}

function emptyCampaignModeProgress(): CampaignModeProgress {
  return {
    completedScenes: {},
    completedFinals: {}
  };
}

function emptyChapterKpiMetrics(): ChapterKpiMetrics {
  return {
    scenes_completed_count: 0,
    safe_choices_count: 0,
    risky_choices_count: 0,
    quiz_correct_count: 0,
    quiz_total_count: 0,
    chapter_final_completed: false,
    risky_tags: {},
    risky_scene_ids: []
  };
}

function emptyCampaignKpiMetrics(): CampaignKpiMetrics {
  return {
    chapters: {},
    overall: emptyChapterKpiMetrics()
  };
}

export function readCampaignProgress(): CampaignProgress {
  const raw = localStorage.getItem(CAMPAIGN_PROGRESS_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as CampaignProgress;
  } catch {
    return {};
  }
}

export function markCampaignSceneCompleted(mode: string, sceneId: string, safe: boolean): CampaignProgress {
  const progress = readCampaignProgress();
  const modeProgress = progress[mode] ?? emptyCampaignModeProgress();

  progress[mode] = {
    ...modeProgress,
    completedScenes: {
      ...modeProgress.completedScenes,
      [sceneId]: { safe }
    }
  };

  localStorage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify(progress));
  return progress;
}

export function markChapterFinalCompleted(mode: string, chapterId: string): CampaignProgress {
  const progress = readCampaignProgress();
  const modeProgress = progress[mode] ?? emptyCampaignModeProgress();

  progress[mode] = {
    ...modeProgress,
    completedFinals: {
      ...modeProgress.completedFinals,
      [chapterId]: true
    }
  };

  localStorage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify(progress));
  return progress;
}

export function readCampaignKpiProgress(): CampaignKpiProgress {
  const raw = localStorage.getItem(CAMPAIGN_KPI_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as CampaignKpiProgress;
  } catch {
    return {};
  }
}

export function recordCampaignSceneKpi(
  mode: string,
  chapterId: string,
  sceneId: string,
  riskLevel: RiskLevel,
  riskyTag?: string
): CampaignKpiProgress {
  const progress = readCampaignKpiProgress();
  const modeMetrics = progress[mode] ?? emptyCampaignKpiMetrics();
  const chapterMetrics = modeMetrics.chapters[chapterId] ?? emptyChapterKpiMetrics();

  chapterMetrics.scenes_completed_count += 1;
  modeMetrics.overall.scenes_completed_count += 1;

  if (riskLevel === 'safe') {
    chapterMetrics.safe_choices_count += 1;
    modeMetrics.overall.safe_choices_count += 1;
  }

  if (riskLevel === 'risky') {
    chapterMetrics.risky_choices_count += 1;
    modeMetrics.overall.risky_choices_count += 1;

    if (riskyTag) {
      chapterMetrics.risky_tags[riskyTag] = (chapterMetrics.risky_tags[riskyTag] ?? 0) + 1;
      modeMetrics.overall.risky_tags[riskyTag] = (modeMetrics.overall.risky_tags[riskyTag] ?? 0) + 1;
    }

    if (!chapterMetrics.risky_scene_ids.includes(sceneId)) {
      chapterMetrics.risky_scene_ids.push(sceneId);
    }
    if (!modeMetrics.overall.risky_scene_ids.includes(sceneId)) {
      modeMetrics.overall.risky_scene_ids.push(sceneId);
    }
  }

  progress[mode] = {
    ...modeMetrics,
    chapters: {
      ...modeMetrics.chapters,
      [chapterId]: chapterMetrics
    }
  };

  localStorage.setItem(CAMPAIGN_KPI_KEY, JSON.stringify(progress));
  return progress;
}

export function recordCampaignQuizKpi(mode: string, chapterId: string, correct: boolean): CampaignKpiProgress {
  const progress = readCampaignKpiProgress();
  const modeMetrics = progress[mode] ?? emptyCampaignKpiMetrics();
  const chapterMetrics = modeMetrics.chapters[chapterId] ?? emptyChapterKpiMetrics();

  chapterMetrics.quiz_total_count += 1;
  modeMetrics.overall.quiz_total_count += 1;

  if (correct) {
    chapterMetrics.quiz_correct_count += 1;
    modeMetrics.overall.quiz_correct_count += 1;
  }

  progress[mode] = {
    ...modeMetrics,
    chapters: {
      ...modeMetrics.chapters,
      [chapterId]: chapterMetrics
    }
  };

  localStorage.setItem(CAMPAIGN_KPI_KEY, JSON.stringify(progress));
  return progress;
}

export function markChapterFinalKpiCompleted(mode: string, chapterId: string): CampaignKpiProgress {
  const progress = readCampaignKpiProgress();
  const modeMetrics = progress[mode] ?? emptyCampaignKpiMetrics();
  const chapterMetrics = modeMetrics.chapters[chapterId] ?? emptyChapterKpiMetrics();

  chapterMetrics.chapter_final_completed = true;
  modeMetrics.overall.chapter_final_completed = true;

  progress[mode] = {
    ...modeMetrics,
    chapters: {
      ...modeMetrics.chapters,
      [chapterId]: chapterMetrics
    }
  };

  localStorage.setItem(CAMPAIGN_KPI_KEY, JSON.stringify(progress));
  return progress;
}
