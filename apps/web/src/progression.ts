import type { CampaignChapter } from './contentEngine';
import type { CampaignModeProgress } from './playerProgress';
import type { CluesCollection } from './cluesCollection';

const TITLES = [
  'Новичок',
  'Следопыт',
  'Защитник',
  'Навигатор',
  'Хранитель цифровой безопасности'
] as const;

export type ProgressSummary = {
  score: number;
  level: number;
  title: string;
  nextTitle: string | null;
  progressToNext: number;
  unlockedDistrictRewards: string[];
};

export function calculateProgressSummary(
  modeProgress: CampaignModeProgress,
  chapters: CampaignChapter[],
  clues: CluesCollection,
  safeChoicesCount: number
): ProgressSummary {
  const sceneCount = Object.keys(modeProgress.completedScenes).length;
  const miniTaskCount = Object.keys(modeProgress.completedMiniTasks ?? {}).length;
  const chapterFinals = Object.keys(modeProgress.completedFinals).filter((key) => modeProgress.completedFinals[key]).length;
  const clueTypes = Object.keys(clues).length;

  const score = sceneCount * 10 + miniTaskCount * 8 + chapterFinals * 20 + clueTypes * 6 + safeChoicesCount * 2;
  const thresholds = [0, 80, 170, 290, 430];

  let level = 1;
  for (let index = thresholds.length - 1; index >= 0; index -= 1) {
    if (score >= thresholds[index]) {
      level = index + 1;
      break;
    }
  }

  const currentThreshold = thresholds[level - 1] ?? 0;
  const nextThreshold = thresholds[level] ?? null;
  const progressToNext = nextThreshold ? Math.max(0, Math.min(100, Math.round(((score - currentThreshold) / (nextThreshold - currentThreshold)) * 100))) : 100;

  const unlockedDistrictRewards = chapters
    .filter((chapter) => modeProgress.completedFinals[chapter.id])
    .map((chapter) => chapter.id);

  return {
    score,
    level,
    title: TITLES[level - 1],
    nextTitle: level >= TITLES.length ? null : TITLES[level],
    progressToNext,
    unlockedDistrictRewards
  };
}

export function getDistrictBadgeName(chapterId: string): string {
  return `Знак района: ${chapterId}`;
}
