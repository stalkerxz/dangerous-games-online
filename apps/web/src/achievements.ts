import type { AchievementItem, AchievementPack } from './contentEngine';

export type GameEvent = {
  type: 'choice_made' | 'quiz_answered' | 'scene_completed' | 'weekly_completed' | 'skill_changed';
  payload: Record<string, string | number | boolean>;
};

type AchievementProgressState = {
  counters: Record<string, number>;
  unlockedAt: Record<string, string>;
};

const STORAGE_KEY = 'dgo-achievements-progress:v1';

const EMPTY_STATE: AchievementProgressState = {
  counters: {},
  unlockedAt: {}
};

function readState(): AchievementProgressState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return EMPTY_STATE;
  }

  try {
    return JSON.parse(raw) as AchievementProgressState;
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(state: AchievementProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function seedDemoAchievements(unlockedIds: string[]) {
  const now = new Date().toISOString();
  const unlockedAt = Object.fromEntries(unlockedIds.map((id) => [id, now]));
  writeState({ counters: {}, unlockedAt });
}

export function clearAchievementProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

function matchesFilters(
  payload: Record<string, string | number | boolean>,
  filters: Record<string, string | number | boolean>
): boolean {
  return Object.entries(filters).every(([key, value]) => payload[key] === value);
}

function currentProgress(item: AchievementItem, state: AchievementProgressState): number {
  if (item.trigger.kind === 'skill_level') {
    return state.counters[item.id] ?? 0;
  }
  return state.counters[item.id] ?? 0;
}

export function processAchievementEvent(pack: AchievementPack | null, event: GameEvent): AchievementProgressState {
  const state = readState();
  if (!pack) {
    return state;
  }

  for (const item of pack.items) {
    if (state.unlockedAt[item.id]) {
      continue;
    }

    if (item.trigger.kind === 'count_event') {
      if (item.trigger.event !== event.type) {
        continue;
      }

      if (item.trigger.filters && !matchesFilters(event.payload, item.trigger.filters)) {
        continue;
      }

      const next = (state.counters[item.id] ?? 0) + 1;
      state.counters[item.id] = next;
      if (next >= item.trigger.target) {
        state.unlockedAt[item.id] = new Date().toISOString();
      }
      continue;
    }

    if (item.trigger.kind === 'skill_level') {
      if (event.type !== 'skill_changed') {
        continue;
      }
      if (event.payload.skill !== item.trigger.skill) {
        continue;
      }

      const level = Number(event.payload.level ?? 0);
      state.counters[item.id] = level;
      if (level >= item.trigger.level) {
        state.unlockedAt[item.id] = new Date().toISOString();
      }
    }
  }

  writeState(state);
  return state;
}

export type AchievementView = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
};

export function getAchievementViews(pack: AchievementPack | null): AchievementView[] {
  if (!pack) {
    return [];
  }

  const state = readState();
  return pack.items.map((item) => {
    const progress = currentProgress(item, state);
    const target = item.trigger.kind === 'skill_level' ? item.trigger.level : item.trigger.target;

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      icon: item.icon,
      unlocked: Boolean(state.unlockedAt[item.id]),
      progress: Math.min(progress, target),
      target
    };
  });
}
