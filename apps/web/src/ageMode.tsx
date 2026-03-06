import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type AgeMode = '8-10' | '11-14' | 'all';

type AgeModeContextValue = {
  ageMode: AgeMode;
  setAgeMode: (mode: AgeMode) => void;
};

const STORAGE_KEY = 'dgo-age-mode:v1';

const AgeModeContext = createContext<AgeModeContextValue>({
  ageMode: '11-14',
  setAgeMode: () => undefined
});

function readAgeMode(): AgeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === '8-10' || stored === '11-14' || stored === 'all') {
    return stored;
  }
  return '11-14';
}

export function AgeModeProvider({ children }: { children: ReactNode }) {
  const [ageMode, setAgeModeState] = useState<AgeMode>(() => readAgeMode());

  const setAgeMode = (mode: AgeMode) => {
    setAgeModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  const value = useMemo(() => ({ ageMode, setAgeMode }), [ageMode]);

  return <AgeModeContext.Provider value={value}>{children}</AgeModeContext.Provider>;
}

export function useAgeMode() {
  return useContext(AgeModeContext);
}
