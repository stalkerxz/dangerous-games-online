export type PackManifestEntry = {
  id: string;
  type: string;
  version: string;
  url: string;
  sha256: string;
};

export type ContentManifest = {
  version: string;
  packs: PackManifestEntry[];
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
};

export type CampaignScene = {
  id: string;
  title: string;
  chat: Array<{ speaker: string; text: string }>;
  choices: SceneChoice[];
};

export type CampaignPack = {
  id: string;
  type: 'campaign';
  version: string;
  title: string;
  scenes: CampaignScene[];
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }
  return (await response.json()) as T;
}

export async function syncContentPacks(): Promise<{
  manifest: ContentManifest | null;
  campaign: CampaignPack | null;
  source: 'network' | 'cache';
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
      return { manifest: null, campaign: null, source: 'cache' };
    }
    const cachedManifest = fallback.data as ContentManifest;
    const campaign = await loadCampaignFromCache(cachedManifest);
    return { manifest: cachedManifest, campaign, source: 'cache' };
  }

  await savePack({ key: 'manifest@latest', hash: manifest.version, data: manifest });

  for (const pack of manifest.packs) {
    const key = toStorageKey(pack);
    const cached = await readPack(key);
    if (cached && cached.hash === pack.sha256) {
      continue;
    }

    const payloadResponse = await fetch(`${API_BASE_URL}${pack.url}`);
    if (!payloadResponse.ok) {
      continue;
    }

    const payloadText = await payloadResponse.text();
    const hash = await digestSHA256(payloadText);
    if (hash !== pack.sha256) {
      continue;
    }

    await savePack({ key, hash: pack.sha256, data: JSON.parse(payloadText) });
  }

  const campaign = await loadCampaignFromCache(manifest);
  return { manifest, campaign, source: 'network' };
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
