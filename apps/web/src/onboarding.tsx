import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type OnboardingContextValue = {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  restartOnboarding: () => void;
};

const STORAGE_KEY = 'dgo-onboarding-complete:v1';

const OnboardingContext = createContext<OnboardingContextValue>({
  hasCompletedOnboarding: false,
  completeOnboarding: () => undefined,
  restartOnboarding: () => undefined
});

function readOnboardingStatus(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => readOnboardingStatus());

  const completeOnboarding = () => {
    setHasCompletedOnboarding(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const restartOnboarding = () => {
    setHasCompletedOnboarding(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ hasCompletedOnboarding, completeOnboarding, restartOnboarding }),
    [hasCompletedOnboarding]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}

