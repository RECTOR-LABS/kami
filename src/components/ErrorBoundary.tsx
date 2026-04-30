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
        className="flex h-screen items-center justify-center bg-kami-sepiaBg text-kami-cream px-6"
      >
        <div className="max-w-lg w-full rounded-2xl border border-kami-cellBorder bg-kami-cellBase p-6 space-y-4">
          <h1 className="text-xl font-display font-bold text-kami-amber">Kami hit a render error.</h1>
          <p className="text-kami-creamMuted text-sm">
            Something inside the app threw while drawing the screen. Reloading usually clears it. If
            it keeps happening, please reach out — the error is logged to the browser console.
          </p>
          {isDev && (
            <pre className="overflow-auto rounded-xl bg-kami-cellElevated border border-kami-cellBorder p-3 text-xs text-kami-amber whitespace-pre-wrap font-mono">
              {error.name}: {error.message}
              {error.stack ? '\n\n' + error.stack : ''}
            </pre>
          )}
          <button
            type="button"
            onClick={this.reload}
            className="inline-flex items-center justify-center rounded-2xl bg-kami-amber hover:opacity-95 active:opacity-90 px-4 py-2 text-sm font-mono font-bold text-kami-sepiaBg transition-opacity"
          >
            Reload Kami
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
