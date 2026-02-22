import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  syncContentPacks,
  type AchievementPack,
  type CampaignPack,
  type ContentManifest,
  type WeeklyPack
} from './contentEngine';

type ContentState = {
  manifest: ContentManifest | null;
  campaign: CampaignPack | null;
  weeklyPacks: WeeklyPack[];
  achievements: AchievementPack | null;
  loading: boolean;
  source: 'network' | 'cache';
  error: string | null;
};

const ContentContext = createContext<ContentState>({
  manifest: null,
  campaign: null,
  weeklyPacks: [],
  achievements: null,
  loading: true,
  source: 'cache',
  error: null
});

export function ContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContentState>({
    manifest: null,
    campaign: null,
    weeklyPacks: [],
    achievements: null,
    loading: true,
    source: 'cache',
    error: null
  });

  useEffect(() => {
    let mounted = true;

    syncContentPacks()
      .then((result) => {
        if (!mounted) return;
        setState({
          manifest: result.manifest,
          campaign: result.campaign,
          weeklyPacks: result.weeklyPacks,
          achievements: result.achievements,
          loading: false,
          source: result.source,
          error: result.manifest ? null : 'Content manifest unavailable'
        });
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to sync content'
        }));
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  return useContext(ContentContext);
}
