import { clearAchievementProgress, seedDemoAchievements } from './achievements';
import { clearCluesCollection, seedDemoClues } from './cluesCollection';
import { clearParentsDemoData, seedParentsDemoData } from './playerProgress';

export const DEMO_MODE_KEY = 'dgo-demo-mode:v1';
const DEMO_BACKUP_KEY = 'dgo-demo-backup:v1';

const DEMO_DATA_KEYS = [
  'dgo-player-progress:v1',
  'dgo-campaign-progress:v1',
  'dgo-campaign-kpi:v1',
  'dgo-risk-clues:v1',
  'dgo-achievements-progress:v1'
] as const;

type DemoBackup = Partial<Record<(typeof DEMO_DATA_KEYS)[number], string | null>>;

function readBackup(): DemoBackup | null {
  const raw = localStorage.getItem(DEMO_BACKUP_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DemoBackup;
  } catch {
    return null;
  }
}

function createBackup() {
  if (readBackup()) {
    return;
  }

  const backup: DemoBackup = {};
  for (const key of DEMO_DATA_KEYS) {
    backup[key] = localStorage.getItem(key);
  }
  localStorage.setItem(DEMO_BACKUP_KEY, JSON.stringify(backup));
}

function restoreBackup() {
  const backup = readBackup();
  if (!backup) {
    return;
  }

  for (const key of DEMO_DATA_KEYS) {
    const value = backup[key];
    if (typeof value === 'string') {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  }

  localStorage.removeItem(DEMO_BACKUP_KEY);
}

export function isDemoModeEnabled(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

export function enableDemoMode(mode: string, achievementIds: string[]) {
  createBackup();
  seedParentsDemoData(mode);
  seedDemoClues();
  seedDemoAchievements(achievementIds);
  localStorage.setItem(DEMO_MODE_KEY, 'true');
}

export function disableDemoMode(options?: { keepDemoData?: boolean }) {
  localStorage.removeItem(DEMO_MODE_KEY);
  if (!options?.keepDemoData) {
    restoreBackup();
  }
}

export function resetDemoData(options?: { dropAllProgress?: boolean }) {
  if (options?.dropAllProgress) {
    clearParentsDemoData();
    clearCluesCollection();
    clearAchievementProgress();
    localStorage.removeItem(DEMO_BACKUP_KEY);
    localStorage.removeItem(DEMO_MODE_KEY);
    return;
  }

  restoreBackup();
  localStorage.removeItem(DEMO_MODE_KEY);
}
