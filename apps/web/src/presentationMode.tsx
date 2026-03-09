import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'dgo:presentation-mode';

type PresentationModeContextValue = {
  presentationMode: boolean;
  setPresentationMode: (value: boolean) => void;
};

const PresentationModeContext = createContext<PresentationModeContextValue | undefined>(undefined);

function readPresentationMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

export function PresentationModeProvider({ children }: { children: ReactNode }) {
  const [presentationMode, setPresentationModeState] = useState<boolean>(() => readPresentationMode());

  const setPresentationMode = (value: boolean) => {
    setPresentationModeState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    }
  };

  const contextValue = useMemo(
    () => ({ presentationMode, setPresentationMode }),
    [presentationMode]
  );

  return <PresentationModeContext.Provider value={contextValue}>{children}</PresentationModeContext.Provider>;
}

export function usePresentationMode() {
  const context = useContext(PresentationModeContext);
  if (!context) {
    throw new Error('usePresentationMode must be used within PresentationModeProvider');
  }

  return context;
}
