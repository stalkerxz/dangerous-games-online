export type PackManifestEntry = {
  id: string;
  type: string;
  version: string;
  url: string;
  sha256: string;
};

export type ContentManifest = {
  version: string;
  content_version?: string;
  packs: PackManifestEntry[];
};


export type AgeMode = '8-10' | '11-14' | 'all';

export type SceneAttachment = {
  type: 'image' | 'file';
  label: string;
  src?: string;
};

export type SceneMessage = {
  speaker: string;
  text: string;
  delay_ms?: number;
  attachment?: SceneAttachment;
};

export type ModeSceneContent = {
  title?: string;
  chat?: SceneMessage[];
  choices?: SceneChoice[];
};

export type ChoiceQuiz = {
  question: string;
  options: string[];
  answerIndex: number;
};

export type SceneChoice = {
  id: string;
  label: string;
  debrief: string;
  quiz: ChoiceQuiz;
  safe?: boolean;
  tags?: string[];
  actions?: string[];
  effects?: {
    risk?: number;
    clues?: string[];
    actions?: string[];
    skills?: Record<string, number>;
  };
};

export type StoryScene = {
  id: string;
  title: string;
  chat: SceneMessage[];
  choices: SceneChoice[];
  tags?: string[];
  miniTask?: SceneMiniTask;
  modes?: AgeMode[];
  modeContent?: Partial<Record<Exclude<AgeMode, 'all'>, ModeSceneContent>>;
};

export type SceneMiniTask =
  | {
      type: 'find_clue';
      prompt: string;
      targetClue: string;
      options: Array<{
        id: string;
        text: string;
        clue: string;
      }>;
      successText: string;
      skill: string;
      algorithm: string;
    }
  | {
      type: 'sort_safe_risky';
      prompt: string;
      items: Array<{
        id: string;
        text: string;
        category: 'safe' | 'risky';
        explanation: string;
      }>;
      skill: string;
      algorithm: string;
    }
  | {
      type: 'build_safe_response';
      prompt: string;
      requiredPicks: number;
      fragments: Array<{
        id: string;
        text: string;
        correct: boolean;
      }>;
      successText: string;
      skill: string;
      algorithm: string;
    };

export type CampaignChapter = {
  id: string;
  title: string;
  scene_ids: string[];
  final_scene: string;
};

export type CampaignPack = {
  id: string;
  type: 'campaign';
  version: string;
  title: string;
  chapters: CampaignChapter[];
  scenes: StoryScene[];
};

export type WeeklyReward = {
  badge: string;
  skills: Record<string, number>;
};

export type WeeklyPack = {
  id: string;
  type: 'weekly';
  version: string;
  start_date: string;
  end_date: string;
  title: string;
  start_scene: string;
  rewards: WeeklyReward;
  scenes: StoryScene[];
};

export type AchievementTrigger =
  | {
      kind: 'count_event';
      event: 'choice_made' | 'quiz_answered' | 'scene_completed' | 'weekly_completed' | 'skill_changed';
      target: number;
      filters?: Record<string, string | number | boolean>;
    }
  | {
      kind: 'skill_level';
      skill: string;
      level: number;
    };

export type AchievementItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  trigger: AchievementTrigger;
};

export type AchievementPack = {
  id: string;
  type: 'achievements';
  version: string;
  items: AchievementItem[];
};

type CachedPackRecord = {
  key: string;
  hash: string;
  data: unknown;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';
const DB_NAME = 'dangerous-games-content';
const STORE_NAME = 'packs';
const STORAGE_PREFIX = 'dgo-content:';
const SYNC_META_KEY = `${STORAGE_PREFIX}sync-meta`;
const CACHE_NAME_PREFIX = 'dgo-content';

let indexedDbReady = typeof window !== 'undefined' && 'indexedDB' in window;

function toStorageKey(pack: Pick<PackManifestEntry, 'id' | 'version'>): string {
  return `${pack.id}@${pack.version}`;
}

async function getDb(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePack(record: CachedPackRecord): Promise<void> {
  if (indexedDbReady) {
    try {
      const db = await getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch {
      indexedDbReady = false;
    }
  }

  localStorage.setItem(`${STORAGE_PREFIX}${record.key}`, JSON.stringify(record));
}

async function readPack(key: string): Promise<CachedPackRecord | null> {
  if (indexedDbReady) {
    try {
      const db = await getDb();
      return await new Promise<CachedPackRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve((request.result as CachedPackRecord | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      indexedDbReady = false;
    }
  }

  const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  return stored ? (JSON.parse(stored) as CachedPackRecord) : null;
}

async function digestSHA256(payload: string): Promise<string> {
  const bytes = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }
  return (await response.json()) as T;
}

type SyncMeta = {
  manifestVersion: string;
  campaignVersion: string | null;
};

function readSyncMeta(): SyncMeta | null {
  const raw = localStorage.getItem(SYNC_META_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SyncMeta>;
    if (!parsed.manifestVersion) {
      return null;
    }
    return {
      manifestVersion: String(parsed.manifestVersion),
      campaignVersion: parsed.campaignVersion ? String(parsed.campaignVersion) : null
    };
  } catch {
    return null;
  }
}

function writeSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

async function clearIndexedDbCache(): Promise<void> {
  if (!('indexedDB' in window)) {
    return;
  }

  await new Promise<void>((resolve) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => resolve();
    deleteRequest.onblocked = () => resolve();
  });

  indexedDbReady = 'indexedDB' in window;
}

export async function resetContentCache(): Promise<void> {
  await clearIndexedDbCache();

  const keysToDelete = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_PREFIX));
  for (const key of keysToDelete) {
    localStorage.removeItem(key);
  }

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.filter((key) => key.startsWith(CACHE_NAME_PREFIX)).map((key) => caches.delete(key)));
  }
}

function getManifestVersion(manifest: ContentManifest): string {
  return manifest.content_version ?? manifest.version;
}

export async function syncContentPacks(): Promise<{
  manifest: ContentManifest | null;
  campaign: CampaignPack | null;
  weeklyPacks: WeeklyPack[];
  achievements: AchievementPack | null;
  source: 'network' | 'cache';
  diagnostics: {
    manifestVersion: string | null;
    campaignVersion: string | null;
  };
}> {
  const manifestUrl = `${API_BASE_URL}/content/manifest.json`;
  let manifest: ContentManifest | null = null;

  try {
    manifest = await fetchJson<ContentManifest>(manifestUrl);
  } catch {
    manifest = null;
  }

  if (!manifest) {
    const fallback = await readPack('manifest@latest');
    if (!fallback) {
      return {
        manifest: null,
        campaign: null,
        weeklyPacks: [],
        achievements: null,
        source: 'cache',
        diagnostics: { manifestVersion: null, campaignVersion: null }
      };
    }
    const cachedManifest = fallback.data as ContentManifest;
    const campaign = await loadCampaignFromCache(cachedManifest);
    const weeklyPacks = await loadWeeklyPacksFromCache(cachedManifest);
    const achievements = await loadAchievementsFromCache(cachedManifest);
    const campaignPack = cachedManifest.packs.find((pack) => pack.type === 'campaign');
    return {
      manifest: cachedManifest,
      campaign,
      weeklyPacks,
      achievements,
      source: 'cache',
      diagnostics: {
        manifestVersion: getManifestVersion(cachedManifest),
        campaignVersion: campaignPack?.version ?? null
      }
    };
  }

  const manifestVersion = getManifestVersion(manifest);
  const campaignPack = manifest.packs.find((pack) => pack.type === 'campaign');
  const campaignVersion = campaignPack?.version ?? null;
  const previousMeta = readSyncMeta();
  const shouldForceRedownload =
    previousMeta !== null &&
    (previousMeta.manifestVersion !== manifestVersion || previousMeta.campaignVersion !== campaignVersion);

  if (shouldForceRedownload) {
    await resetContentCache();
  }

  await savePack({ key: 'manifest@latest', hash: manifestVersion, data: manifest });

  let downloadedFromNetwork = false;

  for (const pack of manifest.packs) {
    const key = toStorageKey(pack);
    const cached = await readPack(key);
    if (!shouldForceRedownload && cached && cached.hash === pack.sha256) {
      continue;
    }

    const payloadResponse = await fetch(`${API_BASE_URL}${pack.url}`, { cache: 'no-store' });
    if (!payloadResponse.ok) {
      continue;
    }

    const payloadText = await payloadResponse.text();
    const hash = await digestSHA256(payloadText);
    if (hash !== pack.sha256) {
      continue;
    }

    await savePack({ key, hash: pack.sha256, data: JSON.parse(payloadText) });
    downloadedFromNetwork = true;
  }

  writeSyncMeta({ manifestVersion, campaignVersion });

  const campaign = await loadCampaignFromCache(manifest);
  const weeklyPacks = await loadWeeklyPacksFromCache(manifest);
  const achievements = await loadAchievementsFromCache(manifest);
  if (!campaignPack || campaign) {
    return {
      manifest,
      campaign,
      weeklyPacks,
      achievements,
      source: downloadedFromNetwork ? 'network' : 'cache',
      diagnostics: {
        manifestVersion,
        campaignVersion
      }
    };
  }

  throw new Error('Campaign pack sync failed. Please retry.');
}

async function loadCampaignFromCache(manifest: ContentManifest): Promise<CampaignPack | null> {
  const campaignPack = manifest.packs.find((pack) => pack.type === 'campaign');
  if (!campaignPack) {
    return null;
  }

  const cached = await readPack(toStorageKey(campaignPack));
  if (!cached || cached.hash !== campaignPack.sha256) {
    return null;
  }

  return cached.data as CampaignPack;
}

async function loadWeeklyPacksFromCache(manifest: ContentManifest): Promise<WeeklyPack[]> {
  const weeklyEntries = manifest.packs.filter((pack) => pack.type === 'weekly');
  const results = await Promise.all(
    weeklyEntries.map(async (weeklyEntry) => {
      const cached = await readPack(toStorageKey(weeklyEntry));
      if (!cached || cached.hash !== weeklyEntry.sha256) {
        return null;
      }
      return cached.data as WeeklyPack;
    })
  );

  return results.filter((pack): pack is WeeklyPack => pack !== null);
}

async function loadAchievementsFromCache(manifest: ContentManifest): Promise<AchievementPack | null> {
  const achievementsPack = manifest.packs.find((pack) => pack.type === 'achievements');
  if (!achievementsPack) {
    return null;
  }

  const cached = await readPack(toStorageKey(achievementsPack));
  if (!cached || cached.hash !== achievementsPack.sha256) {
    return null;
  }

  return cached.data as AchievementPack;
}
