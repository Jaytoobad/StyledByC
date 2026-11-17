import React from 'react';
import { reportClientLog } from '../lib/observability';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ui] unhandled render error:', error, info);
    reportClientLog({
      level: 'error',
      message: error.message || 'render error',
      context: {
        stack: error.stack,
        componentStack: info.componentStack,
      },
      source: 'react.error-boundary',
    });
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="not-found" id="content" role="alert">
          <div className="container">
            <div className="not-found-card">
              <h1>Something went wrong</h1>
              <p>We hit an unexpected problem while loading this page.</p>
              <button type="button" className="btn btn-primary" onClick={this.handleReload}>
                Reload page
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
