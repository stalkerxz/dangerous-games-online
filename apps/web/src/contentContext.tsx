import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  resetContentCache,
  syncContentPacks,
  type AchievementPack,
  type CampaignPack,
  type ContentManifest,
  type WeeklyPack
} from './contentEngine';

type ContentDiagnostics = {
  manifestVersion: string | null;
  campaignVersion: string | null;
};

type ContentState = {
  manifest: ContentManifest | null;
  campaign: CampaignPack | null;
  weeklyPacks: WeeklyPack[];
  achievements: AchievementPack | null;
  loading: boolean;
  source: 'network' | 'cache';
  error: string | null;
  diagnostics: ContentDiagnostics;
  retrySync: () => Promise<void>;
  resetCache: () => Promise<void>;
};

const defaultDiagnostics: ContentDiagnostics = {
  manifestVersion: null,
  campaignVersion: null
};

const noopAsync = async () => {
  return;
};

const ContentContext = createContext<ContentState>({
  manifest: null,
  campaign: null,
  weeklyPacks: [],
  achievements: null,
  loading: true,
  source: 'cache',
  error: null,
  diagnostics: defaultDiagnostics,
  retrySync: noopAsync,
  resetCache: noopAsync
});

export function ContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<ContentState, 'retrySync' | 'resetCache'>>({
    manifest: null,
    campaign: null,
    weeklyPacks: [],
    achievements: null,
    loading: true,
    source: 'cache',
    error: null,
    diagnostics: defaultDiagnostics
  });

  const sync = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const result = await syncContentPacks();
      setState({
        manifest: result.manifest,
        campaign: result.campaign,
        weeklyPacks: result.weeklyPacks,
        achievements: result.achievements,
        loading: false,
        source: result.source,
        diagnostics: result.diagnostics,
        error: result.manifest ? null : 'Content manifest unavailable'
      });
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to sync content'
      }));
    }
  }, []);

  const resetCache = useCallback(async () => {
    await resetContentCache();
    await sync();
  }, [sync]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) {
        return;
      }
      await sync();
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [sync]);

  const value = useMemo(
    () => ({
      ...state,
      retrySync: sync,
      resetCache
    }),
    [resetCache, state, sync]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  return useContext(ContentContext);
}
