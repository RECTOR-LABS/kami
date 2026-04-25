import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[Kami] uncaught render error', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div
        role="alert"
        className="flex h-screen items-center justify-center bg-kami-bg text-kami-text px-6"
      >
        <div className="max-w-lg w-full rounded-lg border border-kami-border bg-kami-surface p-6 space-y-4">
          <h1 className="text-xl font-semibold text-kami-danger">Kami hit a render error.</h1>
          <p className="text-kami-muted text-sm">
            Something inside the app threw while drawing the screen. Reloading usually clears it. If
            it keeps happening, please reach out — the error is logged to the browser console.
          </p>
          {isDev && (
            <pre className="overflow-auto rounded bg-kami-bg border border-kami-border p-3 text-xs text-kami-warning whitespace-pre-wrap">
              {error.name}: {error.message}
              {error.stack ? '\n\n' + error.stack : ''}
            </pre>
          )}
          <button
            type="button"
            onClick={this.reload}
            className="inline-flex items-center justify-center rounded-md bg-kami-accent hover:bg-kami-accentHover px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Reload Kami
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
