import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './styles-extra.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalClientErrorHandlers } from './lib/observability';
import { validateEnv } from './lib/env';

// Validate all required env vars before the app starts
validateEnv();

installGlobalClientErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
