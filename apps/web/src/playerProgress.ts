export type PlayerProgress = {
  completedWeeklyIds: string[];
  badges: string[];
  skills: Record<string, number>;
};

const PROGRESS_KEY = 'dgo-player-progress:v1';

const EMPTY_PROGRESS: PlayerProgress = {
  completedWeeklyIds: [],
  badges: [],
  skills: {}
};

export function readPlayerProgress(): PlayerProgress {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) {
    return EMPTY_PROGRESS;
  }

  try {
    return JSON.parse(raw) as PlayerProgress;
  } catch {
    return EMPTY_PROGRESS;
  }
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

  const progress = { completedWeeklyIds, badges, skills };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  return { updated: true, progress };
}
