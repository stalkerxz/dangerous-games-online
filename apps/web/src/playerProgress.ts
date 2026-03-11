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
  tag_totals: Record<string, number>;
  tag_safe_counts: Record<string, number>;
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


const PROGRESS_UPDATED_EVENT = 'dgo-progress-updated';

function notifyProgressUpdated() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT));
}

function persistProgressKey(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  notifyProgressUpdated();
}

function clearProgressKey(key: string) {
  localStorage.removeItem(key);
  notifyProgressUpdated();
}

export function subscribeProgressUpdates(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (!event.key || [PROGRESS_KEY, CAMPAIGN_PROGRESS_KEY, CAMPAIGN_KPI_KEY].includes(event.key)) {
      listener();
    }
  };

  window.addEventListener(PROGRESS_UPDATED_EVENT, listener);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(PROGRESS_UPDATED_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

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

  persistProgressKey(PROGRESS_KEY, progress);
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
  persistProgressKey(PROGRESS_KEY, progress);
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
    tag_totals: {},
    tag_safe_counts: {},
    risky_scene_ids: []
  };
}

function normalizeChapterKpiMetrics(metrics: Partial<ChapterKpiMetrics> | undefined): ChapterKpiMetrics {
  return {
    scenes_completed_count: metrics?.scenes_completed_count ?? 0,
    safe_choices_count: metrics?.safe_choices_count ?? 0,
    risky_choices_count: metrics?.risky_choices_count ?? 0,
    quiz_correct_count: metrics?.quiz_correct_count ?? 0,
    quiz_total_count: metrics?.quiz_total_count ?? 0,
    chapter_final_completed: metrics?.chapter_final_completed ?? false,
    risky_tags: metrics?.risky_tags ?? {},
    tag_totals: metrics?.tag_totals ?? {},
    tag_safe_counts: metrics?.tag_safe_counts ?? {},
    risky_scene_ids: metrics?.risky_scene_ids ?? []
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

  persistProgressKey(CAMPAIGN_PROGRESS_KEY, progress);
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

  persistProgressKey(CAMPAIGN_PROGRESS_KEY, progress);
  return progress;
}

export function readCampaignKpiProgress(): CampaignKpiProgress {
  const raw = localStorage.getItem(CAMPAIGN_KPI_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as CampaignKpiProgress;
    return Object.fromEntries(
      Object.entries(parsed).map(([mode, modeMetrics]) => {
        const normalizedChapters = Object.fromEntries(
          Object.entries(modeMetrics.chapters ?? {}).map(([chapterId, chapterMetrics]) => [
            chapterId,
            normalizeChapterKpiMetrics(chapterMetrics)
          ])
        );

        return [
          mode,
          {
            chapters: normalizedChapters,
            overall: normalizeChapterKpiMetrics(modeMetrics.overall)
          }
        ];
      })
    );
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
  const chapterMetrics = normalizeChapterKpiMetrics(modeMetrics.chapters[chapterId]);

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

  if (riskyTag && (riskLevel === 'safe' || riskLevel === 'risky')) {
    chapterMetrics.tag_totals[riskyTag] = (chapterMetrics.tag_totals[riskyTag] ?? 0) + 1;
    modeMetrics.overall.tag_totals[riskyTag] = (modeMetrics.overall.tag_totals[riskyTag] ?? 0) + 1;

    if (riskLevel === 'safe') {
      chapterMetrics.tag_safe_counts[riskyTag] = (chapterMetrics.tag_safe_counts[riskyTag] ?? 0) + 1;
      modeMetrics.overall.tag_safe_counts[riskyTag] = (modeMetrics.overall.tag_safe_counts[riskyTag] ?? 0) + 1;
    }
  }

  progress[mode] = {
    ...modeMetrics,
    chapters: {
      ...modeMetrics.chapters,
      [chapterId]: chapterMetrics
    }
  };

  persistProgressKey(CAMPAIGN_KPI_KEY, progress);
  return progress;
}

export function recordCampaignQuizKpi(mode: string, chapterId: string, correct: boolean): CampaignKpiProgress {
  const progress = readCampaignKpiProgress();
  const modeMetrics = progress[mode] ?? emptyCampaignKpiMetrics();
  const chapterMetrics = normalizeChapterKpiMetrics(modeMetrics.chapters[chapterId]);

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

  persistProgressKey(CAMPAIGN_KPI_KEY, progress);
  return progress;
}

export function markChapterFinalKpiCompleted(mode: string, chapterId: string): CampaignKpiProgress {
  const progress = readCampaignKpiProgress();
  const modeMetrics = progress[mode] ?? emptyCampaignKpiMetrics();
  const chapterMetrics = normalizeChapterKpiMetrics(modeMetrics.chapters[chapterId]);

  chapterMetrics.chapter_final_completed = true;
  modeMetrics.overall.chapter_final_completed = true;

  progress[mode] = {
    ...modeMetrics,
    chapters: {
      ...modeMetrics.chapters,
      [chapterId]: chapterMetrics
    }
  };

  persistProgressKey(CAMPAIGN_KPI_KEY, progress);
  return progress;
}

export function seedParentsDemoData(mode: string): { playerProgress: PlayerProgress; campaignKpi: CampaignKpiProgress } {
  const playerProgress: PlayerProgress = {
    completedWeeklyIds: ['weekly-privacy-check', 'weekly-antifake-scan'],
    completedLessonKitIds: ['kit-privacy', 'kit-antifake'],
    badges: ['family-safety-check', 'myth-buster'],
    skills: {
      privacy: 7,
      account: 6,
      antifake: 8,
      communication: 5,
      antibullying: 6
    }
  };

  const campaignProgress: CampaignProgress = {
    [mode]: {
      completedScenes: {
        'chats-sms-code': { safe: true },
        'chats-geolocation': { safe: true },
        'chats-prize-link': { safe: false }
      },
      completedFinals: {
        chats: false
      }
    }
  };

  const chapterMetrics: ChapterKpiMetrics = {
    scenes_completed_count: 9,
    safe_choices_count: 6,
    risky_choices_count: 3,
    quiz_correct_count: 7,
    quiz_total_count: 9,
    chapter_final_completed: false,
    risky_tags: {
      privacy: 1,
      communication: 1,
      account: 1
    },
    tag_totals: {
      privacy: 3,
      account: 2,
      antifake: 2,
      communication: 2
    },
    tag_safe_counts: {
      privacy: 2,
      account: 1,
      antifake: 2,
      communication: 1
    },
    risky_scene_ids: ['chats-geolocation', 'chats-pressure-admin', 'chats-evidence-trade']
  };

  const campaignKpi: CampaignKpiProgress = {
    [mode]: {
      chapters: {
        chats: { ...chapterMetrics }
      },
      overall: { ...chapterMetrics }
    }
  };

  persistProgressKey(PROGRESS_KEY, playerProgress);
  persistProgressKey(CAMPAIGN_PROGRESS_KEY, campaignProgress);
  persistProgressKey(CAMPAIGN_KPI_KEY, campaignKpi);

  return { playerProgress, campaignKpi };
}


export function incrementPlayerSkill(skill: string, amount: number): PlayerProgress {
  const current = readPlayerProgress();
  if (!skill || !Number.isFinite(amount) || amount <= 0) {
    return current;
  }

  const skills = {
    ...current.skills,
    [skill]: (current.skills[skill] ?? 0) + amount
  };

  const progress: PlayerProgress = {
    ...current,
    skills
  };

  persistProgressKey(PROGRESS_KEY, progress);
  return progress;
}

export function clearParentsDemoData() {
  clearProgressKey(PROGRESS_KEY);
  clearProgressKey(CAMPAIGN_PROGRESS_KEY);
  clearProgressKey(CAMPAIGN_KPI_KEY);
}
