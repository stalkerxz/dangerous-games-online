import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { AgeModeProvider } from './ageMode';
import { ContentProvider } from './contentContext';
import { OnboardingProvider } from './onboarding';
import './styles.css';

registerSW({ immediate: true });

const isCapacitorRuntime =
  typeof window !== 'undefined' &&
  typeof (window as Window & { Capacitor?: unknown }).Capacitor !== 'undefined';

const Router = isCapacitorRuntime ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <AgeModeProvider>
        <OnboardingProvider>
          <ContentProvider>
            <App />
          </ContentProvider>
        </OnboardingProvider>
      </AgeModeProvider>
    </Router>
  </React.StrictMode>
);
