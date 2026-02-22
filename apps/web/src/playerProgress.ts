export type PlayerProgress = {
  completedWeeklyIds: string[];
  completedLessonKitIds: string[];
  badges: string[];
  skills: Record<string, number>;
};

const PROGRESS_KEY = 'dgo-player-progress:v1';

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
