import type { SceneChoice, StoryScene } from './contentEngine';

export type ClueEntry = {
  count: number;
  last_seen: string;
  examples: string[];
};

export type CluesCollection = Record<string, ClueEntry>;

const CLUES_COLLECTION_KEY = 'dgo-risk-clues:v1';
const MAX_EXAMPLES = 3;


const CLUES_UPDATED_EVENT = 'dgo-clues-updated';

function notifyCluesUpdated() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(CLUES_UPDATED_EVENT));
}

function persistClues(collection: CluesCollection) {
  localStorage.setItem(CLUES_COLLECTION_KEY, JSON.stringify(collection));
  notifyCluesUpdated();
}

export function subscribeCluesUpdates(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === CLUES_COLLECTION_KEY) {
      listener();
    }
  };

  window.addEventListener(CLUES_UPDATED_EVENT, listener);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(CLUES_UPDATED_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}


const clueDescriptions: Record<string, string> = {
  urgency: 'Давление срочностью: подталкивают действовать немедленно.',
  privacy: 'Риски для личных данных и конфиденциальности.',
  account: 'Угрозы доступу к аккаунту и защите паролей.',
  antifake: 'Проверка фейков, манипуляций и недостоверной информации.',
  evidence: 'Сохранение доказательств и фиксация переписки.',
  bullying_witness: 'Свидетельство буллинга и безопасная поддержка пострадавших.'
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeExample(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 140);
}

export function getClueDescription(clue: string): string {
  return clueDescriptions[clue] ?? 'Поведенческий сигнал риска в цифровом общении.';
}

export function readCluesCollection(): CluesCollection {
  const raw = localStorage.getItem(CLUES_COLLECTION_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<ClueEntry>>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        {
          count: value.count ?? 0,
          last_seen: value.last_seen ?? '',
          examples: Array.isArray(value.examples) ? value.examples.filter((sample) => typeof sample === 'string') : []
        }
      ])
    );
  } catch {
    return {};
  }
}

export function recordSceneClues(scene: StoryScene, choice: SceneChoice): CluesCollection {
  const collection = readCluesCollection();
  const clueSet = new Set<string>([...(scene.tags ?? []), ...(choice.effects?.clues ?? [])].filter(Boolean));
  if (clueSet.size === 0) {
    return collection;
  }

  const candidateExamples = [choice.label, scene.chat[0]?.text]
    .filter((value): value is string => Boolean(value))
    .map(normalizeExample)
    .filter(Boolean);

  for (const clue of clueSet) {
    const current = collection[clue] ?? { count: 0, last_seen: '', examples: [] };
    const mergedExamples = [...current.examples];

    for (const sample of candidateExamples) {
      if (!mergedExamples.includes(sample)) {
        mergedExamples.push(sample);
      }
      if (mergedExamples.length >= MAX_EXAMPLES) {
        break;
      }
    }

    collection[clue] = {
      count: current.count + 1,
      last_seen: nowIso(),
      examples: mergedExamples.slice(0, MAX_EXAMPLES)
    };
  }

  persistClues(collection);
  return collection;
}



export function recordDirectClue(clue: string, example: string): CluesCollection {
  const collection = readCluesCollection();
  const normalizedClue = clue.trim();
  if (!normalizedClue) {
    return collection;
  }

  const current = collection[normalizedClue] ?? { count: 0, last_seen: '', examples: [] };
  const normalizedExample = normalizeExample(example);
  const mergedExamples = [...current.examples];
  if (normalizedExample && !mergedExamples.includes(normalizedExample)) {
    mergedExamples.unshift(normalizedExample);
  }

  collection[normalizedClue] = {
    count: current.count + 1,
    last_seen: nowIso(),
    examples: mergedExamples.slice(0, MAX_EXAMPLES)
  };

  persistClues(collection);
  return collection;
}

export function seedDemoClues(): CluesCollection {
  const now = nowIso();
  const demo: CluesCollection = {
    urgency: {
      count: 4,
      last_seen: now,
      examples: ['Срочно скинь код из СМС', 'У тебя 30 секунд на решение']
    },
    account: {
      count: 3,
      last_seen: now,
      examples: ['Код из СМС — это ключ от аккаунта', 'Проверь ссылку через второй канал']
    },
    privacy: {
      count: 2,
      last_seen: now,
      examples: ['Не отправляй геолокацию незнакомым', 'Личные данные держи в секрете']
    },
    evidence: {
      count: 2,
      last_seen: now,
      examples: ['Сделай скриншот переписки', 'Сохрани вложение как доказательство']
    }
  };

  persistClues(demo);
  return demo;
}

export function clearCluesCollection() {
  localStorage.removeItem(CLUES_COLLECTION_KEY);
  notifyCluesUpdated();
}
