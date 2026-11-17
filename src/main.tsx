import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalClientErrorHandlers } from './lib/observability';

installGlobalClientErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
