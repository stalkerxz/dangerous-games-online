import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { AgeModeProvider } from './ageMode';
import { ContentProvider } from './contentContext';
import './styles.css';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AgeModeProvider>
        <ContentProvider>
          <App />
        </ContentProvider>
      </AgeModeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
